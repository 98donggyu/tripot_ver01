import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, Image, StyleSheet, ScrollView, Dimensions, 
    TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, Alert, FlatList
} from 'react-native';

interface Comment {
    id: number;
    author_name: string;
    comment_text: string;
    created_at: string;
}

interface PhotoDetailProps {
    route: { params: { 
        uri: string; 
        uploader?: string; 
        date?: string; 
        comments?: Comment[];
        photoId: number;
        userId: string;
        apiBaseUrl: string;
    } };
    navigation: { goBack: () => void };
}

const PhotoDetailScreen: React.FC<PhotoDetailProps> = ({ route, navigation }) => {
    const { uri, uploader = '가족', date, comments: initialComments = [], photoId, userId, apiBaseUrl } = route.params || {};
    
    const [aspectRatio, setAspectRatio] = useState(1);
    const [comments, setComments] = useState(initialComments);
    const [author, setAuthor] = useState(''); // 댓글 작성자 이름 상태
    const [commentText, setCommentText] = useState(''); // 댓글 내용 상태

    // ✨ 해결 방법 1: 서버로부터 최신 댓글 목록을 가져오는 함수
    const fetchComments = useCallback(async () => {
        try {
            console.log(`🔍 photoId: ${photoId}의 최신 댓글을 서버에서 가져옵니다.`);
            const response = await fetch(`${apiBaseUrl}/api/v1/family/family-yard/photo/${photoId}/comments`);
            const fetchedComments = await response.json();
            if (response.ok) {
                setComments(fetchedComments);
                console.log(`✅ 최신 댓글 ${fetchedComments.length}개 로딩 완료.`);
            } else {
                console.error("댓글 로딩 실패:", fetchedComments.detail);
            }
        } catch (error) {
            console.error("댓글 로딩 네트워크 오류:", error);
            // 초기 댓글이라도 보여주기 위해 Alert은 생략
        }
    }, [apiBaseUrl, photoId]);

    useEffect(() => {
        if (uri) {
            Image.getSize(uri, (w, h) => setAspectRatio(w / h), () => {});
        }
        // ✨ 해결 방법 2: 화면이 마운트될 때 최신 댓글 목록을 가져옴
        fetchComments();
    }, [uri, fetchComments]);

    const handlePostComment = async () => {
        if (!author.trim() || !commentText.trim()) {
            Alert.alert('알림', '이름과 댓글 내용을 모두 입력해주세요.');
            return;
        }
        try {
            const response = await fetch(`${apiBaseUrl}/api/v1/family/family-yard/photo/${photoId}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id_str: userId,
                    author_name: author,
                    comment_text: commentText,
                }),
            });

            const newComment = await response.json();

            if (response.ok) {
                // UI에 즉시 반영 (낙관적 업데이트)
                setComments(prev => [...prev, newComment]);
                setCommentText(''); // 댓글 입력창만 비우기
            } else {
                Alert.alert('오류', newComment.detail || '댓글 등록에 실패했습니다.');
            }
        } catch (error) {
            console.error("댓글 등록 오류:", error);
            Alert.alert('네트워크 오류', '댓글을 등록할 수 없습니다.');
        }
    };

    if (!uri) {
        return (
            <SafeAreaView style={styles.container}>
                <Text>사진 정보를 불러올 수 없습니다.</Text>
                <TouchableOpacity onPress={navigation.goBack} style={styles.backBtn}>
                    <Text style={styles.backText}>뒤로 가기</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.flex}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={styles.flex}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <FlatList
                    ListHeaderComponent={
                        <>
                            <Image
                                source={{ uri }}
                                style={[styles.photo, { aspectRatio }]}
                                resizeMode="contain"
                            />
                            <View style={styles.meta}>
                                <Text style={styles.uploader}>{uploader === 'senior' ? '어르신' : '가족'}님이 올린 사진</Text>
                                {date && <Text style={styles.date}>{new Date(date).toLocaleString()}</Text>}
                            </View>
                            <View style={styles.commentSectionHeader}>
                                <Text style={styles.commentTitle}>댓글 ({comments.length})</Text>
                            </View>
                        </>
                    }
                    data={comments}
                    keyExtractor={(item, index) => `${item.id}-${index}`}
                    renderItem={({ item }) => (
                        <View style={styles.commentContainer}>
                            <Text style={styles.commentAuthor}>{item.author_name}</Text>
                            <Text style={styles.commentText}>{item.comment_text}</Text>
                            <Text style={styles.commentDate}>{new Date(item.created_at).toLocaleString()}</Text>
                        </View>
                    )}
                    ListFooterComponent={<View style={{ height: 220 }} />}
                />

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="이름"
                        value={author}
                        onChangeText={setAuthor}
                    />
                    <TextInput
                        style={[styles.input, { marginTop: 8 }]}
                        placeholder="댓글을 입력하세요..."
                        value={commentText}
                        onChangeText={setCommentText}
                        multiline
                    />
                    <TouchableOpacity style={styles.postButton} onPress={handlePostComment}>
                        <Text style={styles.postButtonText}>등록</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: '#fff' },
    container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    photo: { width: '100%' },
    meta: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
    uploader: { fontSize: 18, fontWeight: 'bold' },
    date: { fontSize: 14, color: 'gray', marginTop: 4 },
    commentSectionHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    commentTitle: { fontSize: 16, fontWeight: 'bold' },
    commentContainer: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
    commentAuthor: { fontWeight: 'bold', marginBottom: 4 },
    commentText: {},
    commentDate: { fontSize: 12, color: 'gray', marginTop: 4, textAlign: 'right' },
    inputContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#f9f9f9', borderTopWidth: 1, borderTopColor: '#ddd' },
    input: { backgroundColor: 'white', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, borderWidth: 1, borderColor: '#ccc' },
    postButton: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
    postButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    backBtn: { backgroundColor: '#ccc', paddingVertical: 20, alignItems: 'center' },
    backText: { fontSize: 18, fontWeight: 'bold' },
});

export default PhotoDetailScreen;

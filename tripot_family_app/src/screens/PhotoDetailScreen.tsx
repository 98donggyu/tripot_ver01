import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, Image, StyleSheet, 
    TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, 
    Platform, Alert, FlatList
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
    const [author, setAuthor] = useState('');
    const [commentText, setCommentText] = useState('');
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editText, setEditText] = useState('');

    const fetchComments = useCallback(async () => {
        try {
            console.log(`photoId: ${photoId}의 최신 댓글을 서버에서 가져옵니다.`);
            const response = await fetch(`${apiBaseUrl}/api/v1/family/family-yard/photo/${photoId}/comments`);
            const fetchedComments = await response.json();
            if (response.ok) {
                setComments(fetchedComments);
                console.log(`최신 댓글 ${fetchedComments.length}개 로딩 완료.`);
            } else {
                console.error("댓글 로딩 실패:", fetchedComments.detail);
            }
        } catch (error) {
            console.error("댓글 로딩 네트워크 오류:", error);
        }
    }, [apiBaseUrl, photoId]);

    useEffect(() => {
        if (uri) {
            Image.getSize(uri, (w, h) => setAspectRatio(w / h), () => {});
        }
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
                setComments(prev => [...prev, newComment]);
                setCommentText('');
            } else {
                Alert.alert('오류', newComment.detail || '댓글 등록에 실패했습니다.');
            }
        } catch (error) {
            console.error("댓글 등록 오류:", error);
            Alert.alert('네트워크 오류', '댓글을 등록할 수 없습니다.');
        }
    };

    const handleEditComment = async (commentId: number) => {
        if (!editText.trim()) {
            Alert.alert('알림', '댓글 내용을 입력해주세요.');
            return;
        }

        try {
            const response = await fetch(`${apiBaseUrl}/api/v1/family/family-yard/comment/${commentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id_str: userId,
                    comment_text: editText,
                }),
            });

            const result = await response.json();

            if (response.ok) {
                setComments(prev => 
                    prev.map(comment => 
                        comment.id === commentId 
                            ? { ...comment, comment_text: editText }
                            : comment
                    )
                );
                setEditingCommentId(null);
                setEditText('');
                Alert.alert('성공', '댓글이 수정되었습니다.');
            } else {
                Alert.alert('오류', result.detail || '댓글 수정에 실패했습니다.');
            }
        } catch (error) {
            console.error("댓글 수정 오류:", error);
            Alert.alert('네트워크 오류', '댓글을 수정할 수 없습니다.');
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        Alert.alert(
            '댓글 삭제',
            '정말로 이 댓글을 삭제하시겠습니까?',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '삭제',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await fetch(`${apiBaseUrl}/api/v1/family/family-yard/comment/${commentId}`, {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    user_id_str: userId,
                                }),
                            });

                            const result = await response.json();

                            if (response.ok) {
                                setComments(prev => prev.filter(comment => comment.id !== commentId));
                                Alert.alert('성공', '댓글이 삭제되었습니다.');
                            } else {
                                Alert.alert('오류', result.detail || '댓글 삭제에 실패했습니다.');
                            }
                        } catch (error) {
                            console.error("댓글 삭제 오류:", error);
                            Alert.alert('네트워크 오류', '댓글을 삭제할 수 없습니다.');
                        }
                    }
                }
            ]
        );
    };

    const startEditing = (comment: Comment) => {
        setEditingCommentId(comment.id);
        setEditText(comment.comment_text);
    };

    const cancelEditing = () => {
        setEditingCommentId(null);
        setEditText('');
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
                            <View style={styles.commentHeader}>
                                <Text style={styles.commentAuthor}>{item.author_name}</Text>
                                <View style={styles.commentActions}>
                                    <TouchableOpacity 
                                        onPress={() => startEditing(item)}
                                        style={styles.actionButton}
                                    >
                                        <Text style={styles.actionText}>수정</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => handleDeleteComment(item.id)}
                                        style={styles.actionButton}
                                    >
                                        <Text style={[styles.actionText, styles.deleteText]}>삭제</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            
                            {editingCommentId === item.id ? (
                                <View style={styles.editContainer}>
                                    <TextInput
                                        style={styles.editInput}
                                        value={editText}
                                        onChangeText={setEditText}
                                        multiline
                                        placeholder="댓글을 수정하세요..."
                                    />
                                    <View style={styles.editActions}>
                                        <TouchableOpacity 
                                            onPress={cancelEditing}
                                            style={[styles.editButton, styles.cancelButton]}
                                        >
                                            <Text style={styles.editButtonText}>취소</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={() => handleEditComment(item.id)}
                                            style={[styles.editButton, styles.saveButton, { marginLeft: 8 }]}
                                        >
                                            <Text style={[styles.editButtonText, styles.saveText]}>저장</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <Text style={styles.commentText}>{item.comment_text}</Text>
                            )}
                            
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
    commentHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 4 
    },
    commentActions: { 
        flexDirection: 'row' 
    },
    actionButton: { 
        paddingHorizontal: 8, 
        paddingVertical: 4 
    },
    actionText: { 
        fontSize: 12, 
        color: '#007AFF' 
    },
    deleteText: { 
        color: '#FF3B30' 
    },
    editContainer: { 
        marginTop: 8 
    },
    editInput: { 
        backgroundColor: '#f9f9f9', 
        borderRadius: 8, 
        padding: 12, 
        fontSize: 14, 
        borderWidth: 1, 
        borderColor: '#ddd',
        minHeight: 60
    },
    editActions: { 
        flexDirection: 'row', 
        justifyContent: 'flex-end', 
        marginTop: 8
    },
    editButton: { 
        paddingHorizontal: 16, 
        paddingVertical: 8, 
        borderRadius: 6 
    },
    cancelButton: { 
        backgroundColor: '#f0f0f0' 
    },
    saveButton: { 
        backgroundColor: '#007AFF' 
    },
    editButtonText: { 
        fontSize: 14, 
        fontWeight: '600' 
    },
    saveText: { 
        color: 'white' 
    },
    commentAuthor: { fontWeight: 'bold' },
    commentText: { marginTop: 4 },
    commentDate: { fontSize: 12, color: 'gray', marginTop: 8, textAlign: 'right' },
    inputContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#f9f9f9', borderTopWidth: 1, borderTopColor: '#ddd' },
    input: { backgroundColor: 'white', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, borderWidth: 1, borderColor: '#ccc' },
    postButton: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
    postButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    backBtn: { backgroundColor: '#ccc', paddingVertical: 20, alignItems: 'center' },
    backText: { fontSize: 18, fontWeight: 'bold' },
});

export default PhotoDetailScreen;
import React, { useState, useEffect } from 'react';
import { 
    View, Text, Image, StyleSheet, ScrollView, Dimensions, 
    TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, Alert, FlatList
} from 'react-native';

interface Comment { id: number; author_name: string; comment_text: string; created_at: string; }
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

  useEffect(() => {
    if (uri) {
      Image.getSize(uri, (w, h) => setAspectRatio(w / h), () => {});
    }
  }, [uri]);

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
        const result = await response.json();
        if (response.ok && result.status === 'success') {
            setComments(prev => [...prev, result.comment]);
            setCommentText('');
        } else {
            Alert.alert('오류', '댓글 등록에 실패했습니다.');
        }
    } catch (error) {
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
            keyExtractor={(item) => item.id.toString()}
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
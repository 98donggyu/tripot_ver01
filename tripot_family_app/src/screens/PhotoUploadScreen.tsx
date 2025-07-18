import React, { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

interface PhotoUploadScreenProps {
  navigation: {
    goBack: () => void;
    uploadPhoto: (uri: string) => void;
  };
}

const PhotoUploadScreen: React.FC<PhotoUploadScreenProps> = ({ navigation }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleChoosePhoto = () => {
    launchImageLibrary({ mediaType: 'photo' }, (response) => {
      if (response.didCancel) { console.log('User cancelled image picker'); } 
      else if (response.errorCode) { Alert.alert('오류', '사진을 불러올 수 없습니다.'); } 
      else if (response.assets && response.assets.length > 0) { setSelectedImage(response.assets[0].uri || null); }
    });
  };

  const handleUpload = () => {
    if (selectedImage) { navigation.uploadPhoto(selectedImage); } 
    else { Alert.alert('알림', '먼저 사진을 선택해주세요.'); }
  };

  return (
    <SafeAreaView style={uploadStyles.container}>
      <View style={uploadStyles.header}>
        <TouchableOpacity onPress={navigation.goBack}><Text style={uploadStyles.cancelText}>취소</Text></TouchableOpacity>
        <Text style={uploadStyles.headerTitle}>사진 올리기</Text>
        <View style={{width: 40}} />
      </View>
      
      <View style={uploadStyles.content}>
        {selectedImage ? (
          <Image source={{ uri: selectedImage }} style={uploadStyles.imagePreview} />
        ) : (
          <View style={uploadStyles.imagePlaceholder}><Text style={uploadStyles.placeholderText}>선택된 사진이 없습니다.</Text></View>
        )}
        <TouchableOpacity style={uploadStyles.button} onPress={handleChoosePhoto}>
          <Text style={uploadStyles.buttonText}>앨범에서 사진 선택</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[uploadStyles.uploadButton, !selectedImage && uploadStyles.disabledButton]} onPress={handleUpload} disabled={!selectedImage}>
        <Text style={uploadStyles.uploadButtonText}>업로드하기</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const uploadStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cancelText: { fontSize: 16, color: '#007AFF' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  imagePreview: { width: '100%', height: 300, borderRadius: 10, marginBottom: 20 },
  imagePlaceholder: { width: '100%', height: 300, borderRadius: 10, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  placeholderText: { color: '#999' },
  button: { backgroundColor: '#f0f0f0', padding: 15, borderRadius: 10 },
  buttonText: { fontWeight: '500' },
  uploadButton: { backgroundColor: '#007AFF', padding: 20, margin: 20, borderRadius: 10, alignItems: 'center' },
  uploadButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  disabledButton: { backgroundColor: '#ccc' },
});

export default PhotoUploadScreen;
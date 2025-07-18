import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

interface PreviewScreenProps {
  route: { params: { imageUri: string } };
  navigation: {
    goBack: () => void;
    register: (uri: string) => void;
  };
}
const PreviewScreen: React.FC<PreviewScreenProps> = ({ route, navigation }) => {
  const { imageUri } = route.params;
  return (
    <View style={previewStyles.container}>
      <Image source={{ uri: imageUri }} style={previewStyles.image} resizeMode="contain" />
      {/* ✨✨✨ [수정됨] 버튼 컨테이너 스타일을 원래대로 복원합니다. */}
      <View style={previewStyles.buttonsContainer}>
        <TouchableOpacity
          onPress={() => navigation.register(imageUri)}
          style={[previewStyles.button, previewStyles.registerButton]}
        >
          <Text style={previewStyles.buttonText}>등록하기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={navigation.goBack}
          style={[previewStyles.button, previewStyles.retakeButton]}
        >
          <Text style={previewStyles.buttonText}>재촬영</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ✨✨✨ [수정됨] 버튼 스타일을 원래의 크고 세로로 배열된 형태로 복원합니다.
const previewStyles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'black', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  image: { 
    flex: 1,
    width: '100%', 
  },
  buttonsContainer: { 
    position: 'absolute',
    bottom: 40,
    width: '100%', 
    alignItems: 'center' 
  },
  button: { 
    width: '80%', 
    paddingVertical: 20, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginVertical: 10 
  },
  registerButton: { 
    backgroundColor: '#007AFF' 
  },
  retakeButton: { 
    backgroundColor: '#FF3B30' 
  },
  buttonText: { 
    fontSize: 24, 
    color: 'white', 
    fontWeight: 'bold' 
  },
});

export default PreviewScreen;
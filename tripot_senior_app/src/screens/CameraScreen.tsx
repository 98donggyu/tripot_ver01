import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { RNCamera } from 'react-native-camera';

interface CameraScreenProps {
  navigation: { navigateToPreview: (uri: string) => void; goBack: () => void; };
}

const CameraScreen: React.FC<CameraScreenProps> = ({ navigation }) => {
  const cameraRef = useRef<RNCamera>(null);
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const data = await cameraRef.current.takePictureAsync({ quality: 0.8, width: 1080, fixOrientation: true });
        navigation.navigateToPreview(data.uri);
      } catch (error) { Alert.alert('오류', '사진 촬영 중 문제가 발생했습니다.'); }
    }
  };
  return (
    <View style={cameraStyles.container}>
      <RNCamera ref={cameraRef} style={cameraStyles.preview} type={RNCamera.Constants.Type.back} captureAudio={false} ratio="4:3" flashMode={RNCamera.Constants.FlashMode.auto} autoFocus={RNCamera.Constants.AutoFocus.on} androidCameraPermissionOptions={{ title: '카메라 권한', message: '사진 촬영을 위해 카메라 권한이 필요합니다.', buttonPositive: '확인', buttonNegative: '취소' }} />
      <View style={cameraStyles.bottomContainer}>
        <TouchableOpacity onPress={navigation.goBack} style={cameraStyles.controlButton}><Text style={cameraStyles.buttonText}>취소</Text></TouchableOpacity>
        <TouchableOpacity onPress={takePicture} style={cameraStyles.captureButton} />
        <View style={cameraStyles.controlButton} />
      </View>
    </View>
  );
};
const cameraStyles = StyleSheet.create({ container: { flex: 1, backgroundColor: 'black' }, preview: { flex: 1 }, bottomContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingVertical: 30 }, captureButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'white' }, controlButton: { width: 70, alignItems: 'center' }, buttonText: { fontSize: 18, color: 'white', fontWeight: '600' } });
export default CameraScreen;
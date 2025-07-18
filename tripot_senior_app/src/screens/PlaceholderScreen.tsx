import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

interface PlaceholderProps {
  navigation: { goBack: () => void; };
  screenName: string;
}

const PlaceholderScreenComponent: React.FC<PlaceholderProps> = ({ navigation, screenName }) => {
  return (
    <SafeAreaView style={placeholderStyles.container}>
      <View style={placeholderStyles.content}>
        <Text style={placeholderStyles.icon}>🚧</Text>
        <Text style={placeholderStyles.title}>{screenName}</Text>
        <Text style={placeholderStyles.subtitle}>이 기능은 현재 준비 중입니다.</Text>
        <TouchableOpacity
          onPress={navigation.goBack}
          style={placeholderStyles.button}
        >
          <Text style={placeholderStyles.buttonText}>홈으로 돌아가기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const placeholderStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  icon: { fontSize: 80, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 18, color: '#666', marginTop: 10, marginBottom: 30, textAlign: 'center' },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: '600' },
});

export { PlaceholderScreenComponent as PlaceholderScreen };
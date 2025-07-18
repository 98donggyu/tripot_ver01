import React from 'react';
import { View, SectionList, Text, Image, StyleSheet, Dimensions, TouchableOpacity, SafeAreaView, RefreshControl, ActivityIndicator } from 'react-native';

const feedScreenWidth = Dimensions.get('window').width;
const IMAGE_SIZE = feedScreenWidth / 3;

interface Comment { id: number; author_name: string; comment_text: string; created_at: string; }
interface Photo { id: number; uploaded_by: string; created_at: string; comments: Comment[]; }
interface SectionData { title: string; data: Photo[][]; }
interface Props {
  apiBaseUrl: string;
  feedData: { [date: string]: Photo[] };
  isLoading: boolean;
  navigation: { 
    openDetail: (photo: Photo) => void; 
    goBack: () => void; 
    navigateToPhotoUpload: () => void;
  };
  onRefresh: () => void;
}

const FamilyFeedScreen: React.FC<Props> = ({ apiBaseUrl, feedData, isLoading, navigation, onRefresh }) => {
  const sections: SectionData[] = Object.entries(feedData)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, photos]: [string, Photo[]]) => ({
      title: date,
      data: Array.from({ length: Math.ceil(photos.length / 3) }, (_, i) => photos.slice(i * 3, i * 3 + 3)),
    }));

  const renderContent = () => {
    if (isLoading && sections.length === 0) {
      return (<View style={feedStyles.center}><ActivityIndicator size="large" /><Text style={feedStyles.statusText}>가족마당 사진을 불러오는 중...</Text></View>);
    }
    if (sections.length === 0) {
      return (<View style={feedStyles.center}><Text style={feedStyles.emptyText}>아직 공유된 사진이 없어요.</Text><Text style={feedStyles.emptySubText}>아래 '+' 버튼을 눌러 첫 사진을 올려보세요!</Text></View>);
    }
    return (
      <SectionList
        sections={sections}
        keyExtractor={(row, idx) => row.map(p => p.id).join('-') + idx}
        renderSectionHeader={({ section }) => <Text style={feedStyles.header}>{section.title}</Text>}
        renderItem={({ item: row }) => (
          <View style={feedStyles.row}>{row.map(photo => {
            const imageUrl = `${apiBaseUrl}/api/v1/family/family-yard/photo/${photo.id}`;
            return (<TouchableOpacity key={photo.id} onPress={() => navigation.openDetail(photo)} activeOpacity={0.7}><Image source={{ uri: imageUrl }} style={feedStyles.image} /></TouchableOpacity>);
          })}{Array(3 - row.length).fill(0).map((_, i) => <View key={`empty-${i}`} style={feedStyles.image} />)}</View>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
      />
    );
  };

  return (
    <SafeAreaView style={feedStyles.container}>
      <View style={feedStyles.topHeader}>
        <TouchableOpacity onPress={navigation.goBack}><Text style={feedStyles.backButtonText}>‹ 홈</Text></TouchableOpacity>
        <Text style={feedStyles.topHeaderTitle}>가족마당</Text>
        <View style={{width: 50}} />
      </View>
      {renderContent()}
      <TouchableOpacity onPress={navigation.navigateToPhotoUpload} style={feedStyles.fab}>
        <Text style={feedStyles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const feedStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  backButtonText: { fontSize: 18, color: '#007AFF' },
  topHeaderTitle: { fontSize: 18, fontWeight: '600' },
  header: { padding: 12, backgroundColor: '#f7f7f7', fontWeight: 'bold' },
  row: { flexDirection: 'row' },
  image: { width: IMAGE_SIZE, height: IMAGE_SIZE, backgroundColor: '#eaeaea' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  statusText: { marginTop: 10 },
  emptyText: { fontSize: 18, marginBottom: 8 },
  emptySubText: { fontSize: 14, color: 'gray', textAlign: 'center' },
  fab: { position: 'absolute', right: 30, bottom: 40, width: 60, height: 60, borderRadius: 30, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  fabText: { fontSize: 30, color: 'white', lineHeight: 32 },
});

export default FamilyFeedScreen;
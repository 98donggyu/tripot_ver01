import React from 'react';
import { View, SectionList, Text, Image, StyleSheet, Dimensions, TouchableOpacity, SafeAreaView, RefreshControl, ActivityIndicator } from 'react-native';

const IMAGE_SIZE = Dimensions.get('window').width / 3;

interface Comment { id: number; author_name: string; comment_text: string; created_at: string; }
interface Photo { id: number; uploaded_by: string; created_at: string; comments: Comment[]; }
interface SectionData { title: string; data: Photo[][]; }
interface Props {
  apiBaseUrl: string;
  feedData: { [date: string]: Photo[] };
  isLoading: boolean;
  navigation: { openDetail: (photo: Photo) => void; goBack: () => void; };
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
      return (<View style={styles.center}><ActivityIndicator size="large" /><Text style={styles.statusText}>가족마당 사진을 불러오는 중...</Text></View>);
    }
    if (sections.length === 0) {
      return (<View style={styles.center}><Text style={styles.emptyText}>아직 공유된 사진이 없어요.</Text></View>);
    }
    return (
      <SectionList
        sections={sections}
        keyExtractor={(row, idx) => row.map(p => p.id).join('-') + idx}
        renderSectionHeader={({ section }) => <Text style={styles.header}>{section.title}</Text>}
        renderItem={({ item: row }) => (
          <View style={styles.row}>{row.map(photo => {
            const imageUrl = `${apiBaseUrl}/api/v1/family/family-yard/photo/${photo.id}`;
            return (<TouchableOpacity key={photo.id} onPress={() => navigation.openDetail(photo)} activeOpacity={0.7}><Image source={{ uri: imageUrl }} style={styles.image} /></TouchableOpacity>);
          })}{Array(3 - row.length).fill(0).map((_, i) => <View key={`empty-${i}`} style={styles.image} />)}</View>
        )}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderContent()}
      <TouchableOpacity onPress={navigation.goBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>홈으로 돌아가기</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 12, backgroundColor: '#f7f7f7', fontWeight: 'bold' },
  row: { flexDirection: 'row' },
  image: { width: IMAGE_SIZE, height: IMAGE_SIZE, backgroundColor: '#eaeaea' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusText: { marginTop: 10 },
  emptyText: { fontSize: 18 },
  backButton: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 10, alignItems: 'center' },
  backButtonText: { fontSize: 18, fontWeight: 'bold', color: 'white' },
});

export default FamilyFeedScreen;
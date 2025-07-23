import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Alert,
  ActivityIndicator
} from 'react-native';

interface Schedule {
  id: number;
  call_time: string;
  is_enabled: boolean;
  created_at: string;
  set_by: string;
}

interface TimeOption {
  time: string;
  label: string;
}

interface FamilyScheduleManagerProps {
  navigation: { 
    goBack: () => void; 
  };
  familyUserId: string; // 가족 구성원 ID
  seniorUserId: string; // 어르신 ID  
  apiBaseUrl: string;
}

const FamilyScheduleManager: React.FC<FamilyScheduleManagerProps> = ({ 
  navigation, 
  familyUserId, 
  seniorUserId, 
  apiBaseUrl 
}) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [seniorName, setSeniorName] = useState<string>('어르신');

  const timeOptions: TimeOption[] = [
    { time: '07:00', label: '오전 7시 (아침 일찍)' },
    { time: '08:00', label: '오전 8시 (아침)' },
    { time: '09:00', label: '오전 9시' },
    { time: '10:00', label: '오전 10시' },
    { time: '11:00', label: '오전 11시' },
    { time: '12:40', label: '오후 12시 (점심)' },
    { time: '13:00', label: '오후 1시' },
    { time: '14:00', label: '오후 2시' },
    { time: '15:00', label: '오후 3시' },
    { time: '16:00', label: '오후 4시' },
    { time: '17:00', label: '오후 5시' },
    { time: '18:00', label: '오후 6시' },
    { time: '19:00', label: '오후 7시 (저녁)' },
    { time: '20:00', label: '오후 8시' },
    { time: '21:00', label: '오후 9시' },
  ];

  useEffect(() => {
    loadSeniorSchedules();
    loadSeniorInfo();
  }, []);

  // 어르신 정보 조회
  const loadSeniorInfo = async (): Promise<void> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/users/${seniorUserId}`);
      const result = await response.json();
      if (response.ok) {
        setSeniorName(result.name || '어르신');
      }
    } catch (error) {
      console.error('어르신 정보 조회 실패:', error);
    }
  };

  // 어르신의 현재 스케줄 조회
  const loadSeniorSchedules = async (): Promise<void> => {
    try {
      console.log('👨‍👩‍👧‍👦 어르신 스케줄 조회 요청');
      setIsLoading(true);
      
      // 🔧 먼저 일반 스케줄 API 시도 (이미 구현되어 있음)
      try {
        console.log('📡 일반 스케줄 API 시도:', `${apiBaseUrl}/api/v1/schedule/${seniorUserId}`);
        const fallbackResponse = await fetch(`${apiBaseUrl}/api/v1/schedule/${seniorUserId}`);
        const fallbackResult = await fallbackResponse.json();
        
        console.log('📊 일반 스케줄 응답:', fallbackResult);
        
        if (fallbackResponse.ok) {
          console.log('✅ 일반 스케줄 API로 조회 성공:', fallbackResult);
          setSchedules(fallbackResult.schedules || []);
          return;
        }
      } catch (fallbackError) {
        console.log('⚠️ 일반 스케줄 API 실패, 가족용 API 시도');
      }
      
      // 🔧 가족용 API 시도 (아직 구현되지 않을 수 있음)
      console.log('📡 가족용 API 시도:', `${apiBaseUrl}/api/v1/schedule/family/view/${seniorUserId}`);
      const response = await fetch(
        `${apiBaseUrl}/api/v1/schedule/family/view/${seniorUserId}?family_user_id=${familyUserId}`
      );
      const result = await response.json();

      console.log('📊 가족용 스케줄 응답:', result);

      if (response.ok) {
        console.log('✅ 가족용 스케줄 API로 조회 성공:', result);
        setSchedules(result.schedules || []);
      } else {
        console.error('❌ 가족용 스케줄 API 실패:', result);
        // 두 API 모두 실패한 경우에만 알림 표시
        Alert.alert('알림', '스케줄을 불러올 수 없습니다. 일반 스케줄 관리를 사용해주세요.');
        setSchedules([]); // 빈 배열로 설정해서 UI가 계속 동작하도록
      }
    } catch (error) {
      console.error('❌ 스케줄 조회 네트워크 오류:', error);
      Alert.alert('네트워크 오류', '서버에 연결할 수 없습니다.');
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 시간 선택 토글
  const toggleTimeSelection = (time: string): void => {
    setSelectedTimes((prev: string[]) => 
      prev.includes(time) 
        ? prev.filter((t: string) => t !== time)
        : [...prev, time].sort()
    );
  };

  // 어르신 스케줄 변경 (가족이 설정)
  const handleSaveSchedule = async (): Promise<void> => {
    if (selectedTimes.length === 0) {
      Alert.alert('알림', '최소 하나의 시간을 선택해주세요.');
      return;
    }

    Alert.alert(
      '스케줄 변경 확인',
      `${seniorName}의 대화 시간을 다음과 같이 변경하시겠습니까?\n\n${selectedTimes.map(formatTime).join(', ')}\n\n어르신 앱에서 자동으로 알람이 업데이트됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '변경하기',
          onPress: () => saveScheduleToServer()
        }
      ]
    );
  };

  const saveScheduleToServer = async (): Promise<void> => {
    setIsLoading(true);
    try {
      console.log('👨‍👩‍👧‍👦 가족이 어르신 스케줄 변경 요청:', selectedTimes);
      
      // 🔧 수정: 올바른 API 경로 사용
      const response = await fetch(`${apiBaseUrl}/api/v1/schedule/family/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senior_user_id: seniorUserId,
          family_user_id: familyUserId,
          call_times: selectedTimes,
          set_by: 'family'
        })
      });

      const result = await response.json();
      console.log('📊 스케줄 변경 응답:', result);

      if (response.ok) {
        console.log('✅ 어르신 스케줄 변경 성공:', result);
        setSchedules(result.schedules);
        setSelectedTimes([]);
        
        Alert.alert(
          '변경 완료! 🎉',
          `${seniorName}의 대화 시간이 변경되었습니다.\n\n새로운 시간: ${selectedTimes.map(formatTime).join(', ')}\n\n⏰ 어르신 앱에서 5분 이내에 자동으로 업데이트됩니다.`,
          [{ text: '확인' }]
        );
      } else {
        console.error('❌ 스케줄 변경 실패:', result);
        Alert.alert('오류', result.detail || '스케줄 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('❌ 스케줄 변경 네트워크 오류:', error);
      Alert.alert('네트워크 오류', '서버에 연결할 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 시간 형식 변환
  const formatTime = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? '오후' : '오전';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${ampm} ${displayHour}:${minutes}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>‹ 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{seniorName} 대화 시간 관리</Text>
        <View />
      </View>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>처리 중...</Text>
        </View>
      )}

      <ScrollView style={styles.content}>
        {/* 현재 설정된 스케줄 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🕒 현재 {seniorName}의 대화 시간</Text>
          {schedules.length > 0 ? (
            schedules.map((schedule: Schedule) => (
              <View key={schedule.id} style={styles.scheduleItem}>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleTime}>
                    {formatTime(schedule.call_time)}
                  </Text>
                  <Text style={styles.scheduleStatus}>
                    {schedule.is_enabled ? '✅ 활성' : '❌ 비활성'} 
                    {schedule.set_by === 'family' ? ' (가족이 설정)' : ' (어르신이 설정)'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noScheduleText}>설정된 대화 시간이 없습니다.</Text>
          )}
        </View>

        {/* 새 시간 설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏰ 새로운 대화 시간 설정</Text>
          <Text style={styles.sectionDescription}>
            {seniorName}과 대화할 시간을 선택하세요. (복수 선택 가능)
          </Text>
          
          <View style={styles.timeGrid}>
            {timeOptions.map((option: TimeOption) => (
              <TouchableOpacity
                key={option.time}
                style={[
                  styles.timeOption,
                  selectedTimes.includes(option.time) && styles.timeOptionSelected
                ]}
                onPress={() => toggleTimeSelection(option.time)}
              >
                <Text style={[
                  styles.timeOptionText,
                  selectedTimes.includes(option.time) && styles.timeOptionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedTimes.length > 0 && (
            <View style={styles.selectedTimesContainer}>
              <Text style={styles.selectedTimesTitle}>선택된 시간:</Text>
              <Text style={styles.selectedTimesText}>
                {selectedTimes.map((time: string) => formatTime(time)).join(', ')}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.saveButton,
              (selectedTimes.length === 0 || isLoading) && styles.saveButtonDisabled
            ]}
            onPress={handleSaveSchedule}
            disabled={selectedTimes.length === 0 || isLoading}
          >
            <Text style={styles.saveButtonText}>
              {isLoading ? '변경 중...' : `${seniorName} 대화 시간 변경하기`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 안내 메시지 */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>👨‍👩‍👧‍👦 가족 원격 관리</Text>
          <Text style={styles.infoText}>
            • 가족이 어르신의 대화 시간을 원격으로 설정할 수 있습니다{'\n'}
            • 변경사항은 **5분 이내**에 어르신 앱에 자동 반영됩니다{'\n'}
            • 어르신 앱에서 **자동으로 알람이 업데이트**됩니다{'\n'}
            • 변경 시 어르신에게 **알림 메시지**가 표시됩니다{'\n'}
            • 언제든지 다시 변경하거나 추가할 수 있습니다
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  backButton: {
    fontSize: 18,
    color: '#007AFF'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600'
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#fff'
  },
  content: {
    flex: 1,
    padding: 16
  },
  section: {
    marginBottom: 32
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333'
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16
  },
  scheduleItem: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8
  },
  scheduleInfo: {
    flexDirection: 'column'
  },
  scheduleTime: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
  },
  scheduleStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  noScheduleText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    padding: 32
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  timeOption: {
    width: '48%',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  timeOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#0056b3'
  },
  timeOptionText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#333'
  },
  timeOptionTextSelected: {
    color: 'white'
  },
  selectedTimesContainer: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 8,
    marginTop: 16
  },
  selectedTimesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 4
  },
  selectedTimesText: {
    fontSize: 14,
    color: '#1976d2'
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginTop: 24
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc'
  },
  saveButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600'
  },
  infoSection: {
    backgroundColor: '#e8f5e8',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50'
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 8
  },
  infoText: {
    fontSize: 14,
    color: '#2e7d32',
    lineHeight: 20
  }
});

export default FamilyScheduleManager;
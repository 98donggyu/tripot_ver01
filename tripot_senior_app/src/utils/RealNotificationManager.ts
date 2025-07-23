// @ts-nocheck
import PushNotification, { Importance } from 'react-native-push-notification';
import { PermissionsAndroid, Alert, Platform } from 'react-native';

interface NotificationUserInfo {
  action: string;
  scheduled_time?: string;
  user_id?: string;
}

const NOTIFICATION_CHANNEL_ID = 'scheduled-call-high-v1';

class RealNotificationManager {
  private setScreenFunction: ((screen: string) => void) | null = null;
  private checkInterval: any = null; // 🔥 추가: 백그라운드 체크용

  constructor() {
    this.initializeNotifications();
    this.startBackgroundCheck(); // 🔥 추가: 백그라운드 체크 시작
  }

  // 🔥 추가: 백그라운드에서 주기적으로 스케줄 확인
  private startBackgroundCheck(): void {
    console.log('🔄 백그라운드 스케줄 체크 시작 (2분마다)');
    
    // 5초 후 첫 체크
    setTimeout(() => {
      this.checkScheduleUpdate();
    }, 5000);
    
    // 이후 2분마다 체크
    this.checkInterval = setInterval(() => {
      this.checkScheduleUpdate();
    }, 2 * 60 * 1000); // 2분마다
  }

  // 🔥 추가: 서버에서 스케줄 확인하고 필요시 알람 재설정
  private async checkScheduleUpdate(): Promise<void> {
    try {
      console.log('👀 백그라운드 스케줄 확인 중...');
      
      const response = await fetch('http://192.168.101.67:8080/api/v1/schedule/user_1752303760586_8wi64r');
      const result = await response.json();
      
      if (response.ok && result.schedules) {
        const activeTimes = result.schedules
          .filter((s: any) => s.is_enabled)
          .map((s: any) => s.call_time);
          
        if (activeTimes.length > 0) {
          console.log('🔄 백그라운드에서 알람 재설정:', activeTimes);
          this.scheduleConversationAlarm(activeTimes);
        }
      }
    } catch (error) {
      console.log('⚠️ 백그라운드 체크 오류 (정상):', error.message);
    }
  }

  // 화면 전환 함수 설정
  setScreen(setScreenFunc: (screen: string) => void): void {
    this.setScreenFunction = setScreenFunc;
    console.log('🎯 setCurrentScreen 함수 설정됨');
  }

  // 알림 시스템 초기화
  private initializeNotifications(): void {
    PushNotification.configure({
      onNotification: (notification: any) => {
        console.log('📱 푸시 알림 수신:', JSON.stringify(notification, null, 2));

        if (!notification.userInteraction) {
          console.log('ℹ️ 알림이 울렸지만 사용자가 터치하지 않음. (앱 포그라운드 상태)');
          return;
        }

        console.log('✅ 사용자가 알림을 터치했습니다.');
        
        const notificationData = notification.data || notification.userInfo || {};
        const action = notificationData.action;

        if (action === 'scheduled_call') {
          console.log('📞 정시 대화 알림 터치 - 다이얼로그 표시 로직 실행');
          setTimeout(() => {
            this.showCallDialog(notificationData.scheduled_time);
          }, 500);
        }
      },

      onAction: (notification: any) => {
        console.log('🚀 onAction 콜백 실행됨:', notification.action);
        if (notification.action === '지금대화' || notification.action === '대화하기') {
            this.navigateToSpeakScreen();
        } else if (notification.action === '10분후' || notification.action === '다시연기') {
            this.snoozeAlarm(10);
        }
      },

      onRegister: (token: any) => {
        console.log('📱 푸시 토큰:', token);
      },

      permissions: { alert: true, badge: true, sound: true },
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    this.createNotificationChannel();
  }

  // 알림 채널 생성
  private createNotificationChannel(): void {
    PushNotification.createChannel(
      {
        channelId: NOTIFICATION_CHANNEL_ID,
        channelName: '정시 대화 알림 v1',
        channelDescription: '설정한 시간에 울리는 대화 알림',
        playSound: true,
        soundName: 'default',
        importance: Importance.HIGH,
        vibrate: true,
      },
      (created: boolean) => {
        console.log(`✅ 알림 채널 생성: ${created}`);
      }
    );
  }

  // 권한 요청
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: '🔔 알림 권한 필요',
            message: '정시 대화 알림을 받기 위해 알림 권한을 허용해주세요.',
            buttonPositive: '허용',
            buttonNegative: '거부',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    } catch (err) {
      console.warn('권한 요청 오류:', err);
      return false;
    }
  }

  // 정시 대화 스케줄 설정
  scheduleConversationAlarm(times: string[]): void {
    console.log('🚀 scheduleConversationAlarm 호출됨:', times);
    PushNotification.cancelAllLocalNotifications();
    console.log('✅ 기존 알림 모두 취소됨');

    times.forEach((time: string, index: number) => {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledDate = this.getNextScheduledTime(hours, minutes);

      PushNotification.localNotificationSchedule({
        id: 1000 + index,
        channelId: NOTIFICATION_CHANNEL_ID,
        title: '📞 정시 대화 시간이에요!',
        message: '말벗과 대화를 시작하시겠어요? 터치해서 앱을 열어보세요.',
        date: scheduledDate,
        repeatType: 'day',
        playSound: true,
        soundName: 'default',
        vibrate: true,
        vibration: 2000,
        importance: 'high',
        priority: 'high',
        allowWhileIdle: true,
        fullScreenIntent: true,
        userInfo: {
          action: 'scheduled_call',
          scheduled_time: time,
          user_id: 'user_1752303760586_8wi64r'
        } as NotificationUserInfo,
      });

      console.log(`✅ ${time} 푸시 알림 설정 완료 (ID: ${1000 + index})`);
    });
  }

  private getNextScheduledTime(hours: number, minutes: number): Date {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    return scheduledTime;
  }

  // 대화 다이얼로그 표시
  private showCallDialog(scheduledTime?: string): void {
    Alert.alert(
      '📞 정시 대화 시간이에요!',
      scheduledTime ? `${this.formatTime(scheduledTime)}에 예정된 대화 시간입니다.` : '지금 대화를 시작하시겠어요?',
      [
        { text: '지금 대화하기', onPress: () => this.navigateToSpeakScreen() },
        { text: '10분 후에', onPress: () => this.snoozeAlarm(10) },
        { text: '건너뛰기', style: 'cancel' }
      ]
    );
  }

  // 말하기 화면으로 이동
  private navigateToSpeakScreen(): void {
    console.log('🎯 navigateToSpeakScreen 호출됨!');
    if (this.setScreenFunction) {
      console.log('✅ 말하기 화면으로 이동 실행');
      this.setScreenFunction('Speak');
    } else {
      console.error('⚠️ setCurrentScreen 함수가 설정되지 않음');
      Alert.alert('오류', '화면을 이동할 수 없습니다. 앱을 다시 시작해주세요.');
    }
  }

  // 스누즈
  private snoozeAlarm(minutes: number): void {
    const snoozeTime = new Date();
    snoozeTime.setMinutes(snoozeTime.getMinutes() + minutes);

    PushNotification.localNotificationSchedule({
      id: 3001,
      channelId: NOTIFICATION_CHANNEL_ID,
      title: '🔔 연기된 대화 시간',
      message: '이제 대화를 시작해볼까요?',
      date: snoozeTime,
      playSound: true,
      soundName: 'default',
      vibrate: true,
      allowWhileIdle: true,
      fullScreenIntent: true,
      userInfo: { action: 'scheduled_call' } as NotificationUserInfo, 
    });

    Alert.alert('알림 연기', `${minutes}분 후에 다시 알려드릴게요`);
  }

  private formatTime(timeStr: string): string {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? '오후' : '오전';
    const displayHour = hour % 12 || 12;
    return `${ampm} ${displayHour}:${minutes}`;
  }

  cancelAllNotifications(): void {
    PushNotification.cancelAllLocalNotifications();
    console.log('모든 푸시 알림 취소됨');
  }

  async checkPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      return true;
    } catch (err) {
      console.warn('권한 확인 오류:', err);
      return false;
    }
  }
}

export default new RealNotificationManager();
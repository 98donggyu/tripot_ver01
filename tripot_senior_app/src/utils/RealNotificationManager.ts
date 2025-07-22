// @ts-nocheck
import PushNotification, { Importance } from 'react-native-push-notification';
import { PermissionsAndroid, Alert, Platform } from 'react-native';

interface NotificationUserInfo {
  action: string;
  scheduled_time?: string;
  user_id?: string;
}

// ◀️ 수정됨: 채널 ID를 'v3'로 변경하여 설정을 강제로 새로고침합니다.
const NOTIFICATION_CHANNEL_ID = 'scheduled-call-high-v4';

class RealNotificationManager {
  private setScreenFunction: ((screen: string) => void) | null = null;

  constructor() {
    this.initializeNotifications();
  }

  // 화면 전환 함수 설정
  setScreen(setScreenFunc: (screen: string) => void): void {
    this.setScreenFunction = setScreenFunc;
    console.log('🎯 setCurrentScreen 함수 설정됨');
  }

  // 알림 시스템 초기화
  private initializeNotifications(): void {
    PushNotification.configure({
      // 알림을 수신하거나 터치했을 때 호출됨
      onNotification: (notification: any) => {
        console.log('📱 푸시 알림 수신:', JSON.stringify(notification, null, 2));

        // 사용자가 알림을 '터치'했을 때만 아래 로직을 실행
        if (!notification.userInteraction) {
          console.log('ℹ️ 알림이 울렸지만 사용자가 터치하지 않음. (앱 포그라운드 상태)');
          return;
        }

        console.log('✅ 사용자가 알림을 터치했습니다.');
        
        const notificationData = notification.data || notification.userInfo || {};
        const action = notificationData.action;

        // 정시 대화 알림 또는 스누즈된 알림을 터치한 경우
        if (action === 'scheduled_call') {
          console.log('📞 정시 대화 알림 터치 - 다이얼로그 표시 로직 실행');
          setTimeout(() => {
            this.showCallDialog(notificationData.scheduled_time);
          }, 500);
        }
      },

      onAction: (notification: any) => {
        console.log('🚀 onAction 콜백 실행됨 (현재 사용되지 않아야 함):', notification.action);
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

  // 알림 채널 생성 (Android)
  private createNotificationChannel(): void {
    PushNotification.createChannel(
      {
        channelId: NOTIFICATION_CHANNEL_ID, // ◀️ 수정됨: 새로운 채널 ID 사용
        channelName: '정시 대화 알림 v3', // 채널 이름도 변경하여 구별 용이
        channelDescription: '설정한 시간에 울리는 대화 알림',
        playSound: true,
        soundName: 'alarm.mp3', // 기본 알림 소리 사용
        importance: Importance.HIGH,
        vibrate: true,
      },
      (created: boolean) => {
        console.log(`✅ 알림 채널 [${NOTIFICATION_CHANNEL_ID}] 생성 시도... 생성 여부: ${created}`);
        if (created) {
          console.log('ℹ️ 새로운 알림 채널이 생성되었습니다. 이제 소리가 정상적으로 재생되어야 합니다.');
        } else {
          console.log('ℹ️ 기존 알림 채널을 사용합니다. 소리 문제가 계속되면 앱을 삭제 후 재설치해주세요.');
        }
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
            message: '정시 대화 알림을 받기 위해 알림 권한을 허용해주세요.\n\n앱이 꺼져있어도 알림이 울립니다!',
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
        channelId: NOTIFICATION_CHANNEL_ID, // ◀️ 수정됨: 새로운 채널 ID 사용
        title: '📞 정시 대화 시간이에요!',
        message: '말벗과 대화를 시작하시겠어요? 터치해서 앱을 열어보세요.',
        date: scheduledDate,
        repeatType: 'day',
        playSound: true,
        soundName: 'alarm.mp3',
        vibrate: true,
        vibration: 2000,
        importance: 'high',
        priority: 'high',
        allowWhileIdle: true,
        fullScreenIntent: true, // ◀️ 추가됨: 전화 수신 화면처럼 알림을 띄웁니다.
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

  // 스누즈 (10분 후 다시 알림)
  private snoozeAlarm(minutes: number): void {
    const snoozeTime = new Date();
    snoozeTime.setMinutes(snoozeTime.getMinutes() + minutes);

    PushNotification.localNotificationSchedule({
      id: 3001, // 스누즈 전용 ID
      channelId: NOTIFICATION_CHANNEL_ID, // ◀️ 수정됨: 새로운 채널 ID 사용
      title: '🔔 연기된 대화 시간',
      message: '이제 대화를 시작해볼까요?',
      date: snoozeTime,
      playSound: true,
      soundName: 'alarm.mp3',
      vibrate: true,
      allowWhileIdle: true,
      fullScreenIntent: true, // ◀️ 추가됨: 스누즈 알림도 전체 화면으로
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
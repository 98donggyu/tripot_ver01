# tripot_ver01
tripot 프로토타입


# 앱 2개 동시 실행하기

```
npx react-native run-android
npx react-native start --port 8082
```

#### port 8081에 가족 앱 연결 후 어르신 앱 키고 
```
adb shell input keyevent 82

```
 - change bundle location 클릭 후 ip주소:8082
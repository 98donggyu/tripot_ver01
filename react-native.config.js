module.exports = {
  dependencies: {
    'react-native-push-notification': {
      platforms: {
        android: {
          sourceDir: '../node_modules/react-native-push-notification/android/',
          packageImportPath: 'import com.dieam.reactnativepushnotification.ReactNativePushNotificationPackage;',
        },
      },
    },
  },
};
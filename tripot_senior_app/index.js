import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

console.log('=== DEBUG: App name from app.json:', appName);
AppRegistry.registerComponent(appName, () => App);
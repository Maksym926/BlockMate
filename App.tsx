import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { roomsApi, type Room, type RoomPreview } from './src/data/app';
import { CreateRoom } from './src/screens/CreateRoom';
import { JoinCode } from './src/screens/JoinCode';
import { JoinName } from './src/screens/JoinName';
import { JoinScan } from './src/screens/JoinScan';
import { RoomCode } from './src/screens/RoomCode';
import { RoomHome } from './src/screens/RoomHome';
import { Welcome } from './src/screens/Welcome';
import { Button } from './src/ui/components';
import { color } from './src/ui/theme';

// UC-01 flow. A small route union is enough for this linear flow; no navigation library needed.
type Route =
  | { name: 'loading' }
  | { name: 'startFailed' }
  | { name: 'welcome' }
  | { name: 'create' }
  | { name: 'roomCode'; room: Room }
  | { name: 'scan' }
  | { name: 'typeCode'; cameraDenied: boolean; code?: string; error?: string }
  | { name: 'joinName'; code: string; preview: RoomPreview }
  | { name: 'home'; room: Room };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const routeName = useRef(route.name);
  routeName.current = route.name;
  const cameraDenied = useRef(false);

  // Reopen straight into the room if this device already belongs to one (UC-01 4c).
  useEffect(() => {
    setRoute({ name: 'loading' });
    roomsApi.start().then(
      (room) => setRoute(room ? { name: 'home', room } : { name: 'welcome' }),
      () => setRoute({ name: 'startFailed' }),
    );
  }, [attempt]);

  const lookUp = useCallback(async (code: string) => {
    const preview = await roomsApi.preview(code);
    // The resident may have pressed Back while this was in flight; do not pull them forward again.
    if (routeName.current === 'scan' || routeName.current === 'typeCode') {
      setRoute({ name: 'joinName', code, preview });
    }
  }, []);
  const toTypeCode = useCallback((denied: boolean) => {
    cameraDenied.current = denied;
    setRoute({ name: 'typeCode', cameraDenied: denied });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {renderRoute()}
    </SafeAreaProvider>
  );

  function renderRoute() {
    switch (route.name) {
      case 'loading':
        return (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface0 }}>
            <ActivityIndicator color={color.brand} />
          </View>
        );
      case 'startFailed':
        return (
          <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: color.surface0 }}>
            <Text style={{ fontSize: 16, color: color.ink }}>
              Can't reach the server. Check your connection and try again.
            </Text>
            <Button label="Try again" onPress={() => setAttempt((n) => n + 1)} />
          </View>
        );
      case 'welcome':
        return <Welcome onCreate={() => setRoute({ name: 'create' })} onJoin={() => setRoute({ name: 'scan' })} />;
      case 'create':
        return (
          <CreateRoom
            onBack={() => setRoute({ name: 'welcome' })}
            onCreated={(room) => setRoute({ name: 'roomCode', room })}
          />
        );
      case 'roomCode':
        return (
          <RoomCode
            room={route.room}
            onBack={() => setRoute({ name: 'home', room: route.room })}
            onOpen={() => setRoute({ name: 'home', room: route.room })}
          />
        );
      case 'scan':
        return (
          <JoinScan
            onBack={() => setRoute({ name: 'welcome' })}
            onTypeInstead={toTypeCode}
            lookUp={lookUp}
            onScanFailed={(error) => setRoute({ name: 'typeCode', cameraDenied: false, error })}
          />
        );
      case 'typeCode':
        return (
          <JoinCode
            // With the camera denied, "scan" would bounce straight back here, so go to the start instead.
            onBack={() => setRoute(route.cameraDenied ? { name: 'welcome' } : { name: 'scan' })}
            onCreateInstead={() => setRoute({ name: 'create' })}
            lookUp={lookUp}
            cameraDenied={route.cameraDenied}
            initialCode={route.code}
            initialError={route.error}
          />
        );
      case 'joinName':
        return (
          <JoinName
            code={route.code}
            preview={route.preview}
            onBack={() => setRoute({ name: 'typeCode', cameraDenied: cameraDenied.current, code: route.code })}
            onJoined={(room) => setRoute({ name: 'home', room })}
          />
        );
      case 'home':
        return <RoomHome room={route.room} onShowCode={() => setRoute({ name: 'roomCode', room: route.room })} />;
    }
  }
}

/**
 * BARADA CODE — ADMIN CONSOLE (Expo Go).
 *
 * This app is exclusively the admin control center.
 * Open → Admin Login → verified server-side → Control Center.
 * There is no user-facing chat/builder UI here.
 */

import { StatusBar } from "react-native";
import AdminApp from "./Admin";

export default function App() {
  return (
    <>
      <StatusBar barStyle="light-content" />
      <AdminApp />
    </>
  );
}

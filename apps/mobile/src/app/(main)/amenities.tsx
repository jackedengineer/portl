import { Redirect } from 'expo-router';
import { useAppStore } from '../../lib/state';
import Amenities from '../../features/amenities';
export default function Screen() {
  return useAppStore((s) => s.role) === 'guard' ? <Redirect href="/" /> : <Amenities />;
}

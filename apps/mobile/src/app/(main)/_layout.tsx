import { Slot } from 'expo-router';
import { Frame } from '../../components/frame';
export default function MainLayout() {
  return (
    <Frame>
      <Slot />
    </Frame>
  );
}

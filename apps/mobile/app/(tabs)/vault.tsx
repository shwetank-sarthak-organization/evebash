import { VaultScreen } from '@/components/vault/VaultScreen';
import { DarkThemeScope } from '@/context/ThemeContext';

// EB Vault opens from the Profile tab (below Usage & Plan); it is not a bottom-tab item. It keeps its own dark look
// whatever the Appearance choice (todo #1).
export default function VaultTab() {
  return (
    <DarkThemeScope>
      <VaultScreen />
    </DarkThemeScope>
  );
}

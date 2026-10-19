import { LegalPolicyScreen } from '@/components/LegalPolicyScreen';
import { getPolicy } from '../../../shared/legal/index';

export default function PolicyScreen() {
  return <LegalPolicyScreen {...getPolicy('privacy-policy')} />;
}

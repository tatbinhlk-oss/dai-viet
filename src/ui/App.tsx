import { TopBar } from './TopBar';
import { BuildBar } from './BuildBar';
import { InfoPanel } from './InfoPanel';
import { Advisors } from './Advisors';
import { hoverText } from './store';

export function App() {
  return (
    <>
      <TopBar />
      <BuildBar />
      <InfoPanel />
      <Advisors />
      <div class="status">{hoverText.value}</div>
    </>
  );
}

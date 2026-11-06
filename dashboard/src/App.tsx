import { Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Overview } from './pages/Overview';
import { Soon } from './pages/Soon';

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Overview />} />
        <Route path="0g" element={<Soon title="0G" line="The AI judge, Storage and Chain proofs arrive in the next batch." />} />
        <Route path="ens" element={<Soon title="ENS" line="Licences and their key-value records arrive in the next batch." />} />
        <Route path="world" element={<Soon title="World" line="Check-ins and the human proof arrive in the next batch." />} />
        <Route path="live" element={<Soon title="Live" line="The live headset view arrives in a later batch." />} />
        <Route path="verify/*" element={<Soon title="Verify" line="Paste a licence name to check it end to end." />} />
        <Route path="log" element={<Soon title="Log" line="Every event in one stream." />} />
        <Route path="*" element={<Soon title="Not found" line="That page does not exist." />} />
      </Route>
    </Routes>
  );
}

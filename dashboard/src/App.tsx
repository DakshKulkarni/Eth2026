import { Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { CheckIn } from './pages/CheckIn';
import { Ens } from './pages/Ens';
import { Live } from './pages/Live';
import { Log } from './pages/Log';
import { Overview } from './pages/Overview';
import { Verify } from './pages/Verify';
import { World } from './pages/World';
import { ZeroG } from './pages/ZeroG';
import { Soon } from './pages/Soon';

export function App() {
  return (
    <Routes>
      <Route path="checkin" element={<CheckIn />} />
      <Route element={<Shell />}>
        <Route index element={<Overview />} />
        <Route path="0g" element={<ZeroG />} />
        <Route path="ens" element={<Ens />} />
        <Route path="world" element={<World />} />
        <Route path="live" element={<Live />} />
        <Route path="verify/*" element={<Verify />} />
        <Route path="log" element={<Log />} />
        <Route path="*" element={<Soon title="Not found" line="That page does not exist." />} />
      </Route>
    </Routes>
  );
}

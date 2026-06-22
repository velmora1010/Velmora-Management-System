import { Outlet } from 'react-router-dom';
import { IntakeProvider } from './IntakeContext';

const IntakeWorkflow = () => {
  return (
    <IntakeProvider>
      <div className="page">
        <Outlet />
      </div>
    </IntakeProvider>
  );
};

export default IntakeWorkflow;

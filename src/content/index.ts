import { FocusController } from './controller';

// Content script entry. Intentionally tiny: all logic lives in testable modules and
// the React UI is never injected into YouTube pages.
const controller = new FocusController();
void controller.start().catch((e) => console.error('FocusTube failed to start', e));

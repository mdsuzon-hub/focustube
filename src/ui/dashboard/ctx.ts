import type { AppState } from '../store';
import type { Message, Response } from '../../shared/messages';

export interface PageProps extends AppState {
  now: number;
  act: (msg: Message, okText?: string) => Promise<Response>;
}

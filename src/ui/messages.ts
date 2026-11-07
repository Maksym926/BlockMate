import { RoomError } from '../data/app';

export const NAME_REQUIRED_MESSAGE = 'Add your name so flatmates know who you are.';
export const ROOM_NAME_REQUIRED_MESSAGE = 'Give your room a name.';
export const CODE_REQUIRED_MESSAGE = "Enter the code from your flatmate's phone.";

/** Resident-facing wording for data-layer errors (copy from the Flows canvas error states, D-025). */
export function messageFor(error: unknown, roomName?: string): string {
  const code = error instanceof RoomError ? error.code : 'UNKNOWN';
  switch (code) {
    case 'NAME_REQUIRED':
      return NAME_REQUIRED_MESSAGE;
    case 'ROOM_NAME_REQUIRED':
      return ROOM_NAME_REQUIRED_MESSAGE;
    case 'NAME_TAKEN':
      return `Someone in ${roomName ?? 'this room'} already uses that name. Try another.`;
    case 'ROOM_NOT_FOUND':
      return "We can't find a room with that code. Check it and try again.";
    default:
      return 'Something went wrong. Check your connection and try again.';
  }
}

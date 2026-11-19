/** Training / Learning management types */

export type TrainingProgram = {
  id: string;
  code: string;
  name: string;
  type: string;
  hostName: string;
  hostEmployeeId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  roomId: string;
  roomName: string;
  isRecurring: boolean;
  recurrenceRule: string;
  notes: string;
  status: string;
  version: number;
  attendeeCount: number;
};

export type TrainingRoom = {
  id: string;
  code: string;
  name: string;
  capacity: number;
  equipment: string[];
  notes: string;
  status: string;
  version: number;
  branchId: string;
};

export type TrainingRequest = {
  id: string;
  code: string;
  title: string;
  requestType: string;
  requestedByEmployeeId: string;
  hostEmployeeId: string;
  hostName: string;
  roomId: string;
  roomName: string;
  requestDate: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  recurrenceRule: string;
  attendees: { employeeId: string; employeeName: string; employeeCode: string }[];
  agenda: string;
  approvalNotes: string;
  status: string;
  trainingId: string;
  version: number;
  branchId: string;
};

export type TrainingNotification = {
  id: string;
  employeeId: string;
  employeeName: string;
  trainingId: string;
  trainingName: string;
  date: string;
  time: string;
  message: string;
  read: boolean;
  at: string;
};

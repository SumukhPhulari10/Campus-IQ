# Timetable Upload & Real-Time Sync Flow

We will implement a seamless, real-time feature where a Teacher uploading a timetable immediately updates the Students' dashboards.

## User Review Required
Please review the proposed approach below. Once approved, I will implement it!

## Proposed Changes

### 1. `src/components/StudentDashboard.tsx`
- **[MODIFY]** Remove the "Quick Links / Campus Portals" component as requested.

### 2. `src/App.tsx` (AppShell)
- **[MODIFY]** Convert the static `nextClass` data into React state (`[nextClass, setNextClass]`) so it can be updated in real-time.
- **[MODIFY]** Enhance `handleDocumentAdded`: When a Teacher uploads a document with the category **"Timetable"** or containing the word "Timetable":
  - Simulate an AI extraction of the timetable schedule.
  - Dynamically update the `nextClass` state to reflect a new upcoming class from the uploaded timetable.
  - Automatically generate an `Urgent` or high-priority **Notice** alerting all students: "New Timetable Uploaded for your department!"

### 3. `src/components/UploadDocument.tsx` 
- **[MODIFY]** Add a specific "Timetable / Schedule" option to the document category dropdown so teachers can easily classify it.

## Verification Plan
1. **Teacher Action**: Log in as a Teacher and use the "Upload Material" section to upload a mock PDF named "Fall_Timetable.pdf" with the category "Timetable".
2. **Real-time Sync**: We will verify that a high-priority notification is instantly generated.
3. **Student Action**: Log in as a Student and verify that the "Next Upcoming Class" widget on the Dashboard has automatically changed to reflect the newly uploaded timetable data.

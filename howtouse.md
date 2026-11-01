# How to Run the Project

1. Open a terminal in the project folder.

2. Install the backend dependencies:

   ```powershell
   python -m pip install -r backend/requirements.txt
   ```

3. Generate the map and shelter data. This requires an internet connection and
   may take a few minutes:

   ```powershell
   python -m backend.scripts.generate_dataset
   ```

4. Start the backend and leave this terminal open:

   ```powershell
   python -m uvicorn backend.app:app --reload
   ```

5. Open a second terminal in the project folder and start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

6. Open the app in your browser: http://localhost:3000

The shelters, flood scenarios, and route estimates are simulated. This project
is for academic demonstration and is not for real emergency decisions.

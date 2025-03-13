const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const { google } = require('googleapis');
const path = require('path');
const { Readable } = require('stream');
require('dotenv').config();
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

// Allow CORS for frontend requests
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'https://8383-2401-4900-52b2-2d88-e19e-4232-5d1f-969e.ngrok-free.app','http://127.0.0.1:5500','https://formscypui-gpwl8kifi-scarrangers-projects.vercel.app'];

app.use(express.static(__dirname)); 

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Firebase Admin SDK
try {
    admin.app();
} catch (error) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
    });
}

const db = admin.firestore();

// Google Drive API setup
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
const drive = google.drive({ version: 'v3', auth });
const FOLDER_ID = process.env.DRIVE_FOLDER_ID; // Replace with your Google Drive folder ID

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            return cb(new Error('Only image files are allowed (JPEG, PNG, GIF)'));
        }
    }
});

// Upload file to Google Drive
async function uploadToGoogleDrive(fileBuffer, fileName, mimeType) {
    const fileMetadata = {
        name: `${fileName}_${Date.now()}`,
        parents: [FOLDER_ID],
    };

    const bufferStream = new Readable();
    bufferStream.push(fileBuffer);
    bufferStream.push(null);

    const media = {
        mimeType: mimeType,
        body: bufferStream,
    };

    try {
        const res = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        console.log('File uploaded to Google Drive:', res.data);
        return res.data.webViewLink;
    } catch (error) {
        console.error('Error uploading to Google Drive:', error);
        throw error;
    }
}

// Google Sheets API Setup
const credentials = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

async function appendDataToSheet(data) {
    try {
        const auth = await credentials.getClient();
        const sheets = google.sheets({ version: 'v4', auth });

        const spreadsheetId = process.env.APPEND_SHEETID; // Replace with your Google Sheet ID
        const range = process.env.APPEND_SHEET_RANGE;

        const values = [data]; // Data to append

        const request = {
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: { values },
        };

        const response = await sheets.spreadsheets.values.append(request);
        console.log('Data appended to Google Sheet:', response.data);
        return response.data.updates.updatedRange; // Return the updated range

    } catch (error) {
        console.error('Google Sheets API error:', error);
        throw error;
    }
}

// Fetch dynamic form fields from Google Sheets
async function fetchFormFields() {
    try {
        const auth = await credentials.getClient();
        const sheets = google.sheets({ version: 'v4', auth });

        const spreadsheetId = process.env.FETCH_SHEET_ID;
        const range = process.env.FETCH_SHEET_RANGE;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = response.data.values;
        if (!rows) return [];

        return rows.map(row => ({
            name: row[0],                // Field Name
            type: row[1] || 'text',      // Field Type
            required: row[2] === 'true', // Required or not
            options: row[3] ? row[3].split('|') : [] // Dropdown options (if available)
        }));

    } catch (error) {
        console.error('Error fetching form fields:', error);
        return [];
    }
}

// API to fetch form fields
app.get('/get_form_fields', async (req, res) => {
    const fields = await fetchFormFields();
    res.json(fields);
});

// Dynamic form submission
app.post('/submit_form', upload.any(), async (req, res) => {
    try {
        console.log(req.body);
        console.log(req.files);

        let formData = { ...req.body }; // Copy request body

        // Remove unwanted fields like "submit"
        delete formData.submit;

        let imageUrl = null;

        if (req.files && req.files.length > 0) {
            const file = req.files[0];
            imageUrl = await uploadToGoogleDrive(file.buffer, formData.name || 'uploaded_image', file.mimetype);
        }

        const docRef = db.collection('OneDay').doc();
        const docId = docRef.id;

        // Append the image URL and other form data to Google Sheets
        const updatedRange = await appendDataToSheet([...Object.values(formData), imageUrl, docId]);

        const formEntry = { ...formData, imageUrl, docId, updatedRange };

        await docRef.set(formEntry);

        res.json({ success: true, message: "Data stored successfully!", imageUrl });

    } catch (error) {
        console.error("Error submitting form:", error);
        res.status(500).json({ success: false, message: "An error occurred.", error: error.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'index.html'));
// });

// Start server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
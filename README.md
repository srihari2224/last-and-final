# File Transfer System

A modern file sharing system with QR code-based mobile uploads and S3 storage.

## Features

- 📱 QR code-based mobile file uploads
- ☁️ AWS S3 cloud storage
- 🔄 Real-time file synchronization
- 📁 Session-based file organization
- 🎨 Modern, responsive UI

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# AWS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1

# S3 Bucket Configuration
FILE_STORAGE_BUCKET=your-s3-bucket-name

# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend Environment Variables (for Vite)
VITE_AWS_ACCESS_KEY_ID=your_aws_access_key_id
VITE_AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
VITE_AWS_REGION=us-east-1
VITE_FILE_STORAGE_BUCKET=your-s3-bucket-name
```

### 3. AWS S3 Setup

1. Create an S3 bucket for file storage
2. Configure CORS for your S3 bucket:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]
```

3. Set bucket permissions to allow public read access (if needed)

### 4. Start the Development Server

```bash
# Terminal 1: Start the backend server
npm run server

# Terminal 2: Start the frontend development server
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Mobile upload page: http://localhost:3001/scan.html

## Usage

1. Open the application in your browser
2. Click "Get Started" to generate a QR code
3. Scan the QR code with your mobile device
4. Upload files through the mobile interface
5. Files will appear in the desktop interface automatically

## Troubleshooting

### Common Issues

1. **404 Favicon Error**: Fixed by using a data URI favicon
2. **CORS Errors**: Fixed by adding proper CORS headers to the backend
3. **401 Unauthorized**: Fixed by using local API instead of remote
4. **Missing scan.html**: Created mobile upload interface

### Environment Variables

Make sure all required environment variables are set:
- AWS credentials for S3 access
- S3 bucket name
- AWS region

### S3 Permissions

Ensure your AWS credentials have the following S3 permissions:
- `s3:PutObject`
- `s3:GetObject`
- `s3:DeleteObject`
- `s3:ListBucket`

## API Endpoints

- `POST /api/upload` - Upload files to S3
- `GET /api/health` - Health check endpoint
- `GET /scan.html` - Mobile upload interface

## Technologies Used

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Express.js, Multer
- **Storage**: AWS S3
- **QR Code**: qrcode library
- **UI Components**: Radix UI
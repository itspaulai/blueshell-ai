
# Blueshell - Local Browser AI Chat with PDF Support

A web application that runs an AI model directly in your browser, featuring PDF document analysis and chat functionality. Built with React, TypeScript, and TailwindCSS.

## Features

- 🤖 **Local AI Model**: Runs entirely in your browser for privacy and offline functionality
- 📄 **PDF Analysis**: Upload and analyze PDF documents
- 💬 **Chat Interface**: Natural conversation with AI about general topics and PDF content
- 🎨 **Modern UI**: Built with Radix UI components and TailwindCSS
- 💾 **Persistent Storage**: Automatically saves chat history
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Getting Started

1. Clone the project in Replit
2. Install dependencies:
```bash
npm install
```
3. Start the development server:
```bash
npm run dev
```

The application will be available at the URL provided by Replit.

## Project Structure

```
├── client/                # Frontend React application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utility functions and workers
│   │   ├── pages/       # Page components
│   │   └── types/       # TypeScript type definitions
├── server/               # Backend Express server
│   ├── routes.ts        # API routes
│   └── index.ts         # Server configuration
└── db/                  # Database schema and configuration
```

## Technology Stack

- **Frontend**: React, TypeScript, TailwindCSS, Radix UI
- **Backend**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Web-LLM for browser-based inference
- **PDF Processing**: PDF.js

## Features in Detail

### AI Model
- Local browser-based AI model
- Automatic model downloading and caching
- Privacy-focused with no data sent to external servers

### PDF Functionality
- Upload and process PDF documents
- Extract text content for AI analysis
- Reference specific parts of documents in responses

### Chat Interface
- Real-time conversation with AI
- Save and manage chat history
- Rename and organize conversations
- Collapsible sidebar for better space management

## Development

The project uses Vite for development and building. Main scripts:

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run check`: Type checking with TypeScript

## License

MIT

## Contact

For support or inquiries, use the contact button within the application's help dialog.

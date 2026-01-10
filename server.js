#!/usr/bin/env node

/**
 * Simple HTTP Server for Urgent Travel Application
 * 
 * Usage:
 *   node server.js [port]
 * 
 * Default port: 8000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 8000;
const PROJECT_ROOT = __dirname;

// MIME types for different file extensions
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

const server = http.createServer((req, res) => {
    // Remove query string and normalize the path
    let filePath = '.' + req.url.split('?')[0];
    
    // Default to index.html for root
    if (filePath === './') {
        filePath = './index.html';
    }
    
    // Get full path
    const fullPath = path.join(PROJECT_ROOT, filePath);
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    // Security: Prevent directory traversal
    if (!fullPath.startsWith(PROJECT_ROOT)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    // Read and serve the file
    fs.readFile(fullPath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // File not found
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>404 - File Not Found</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                            h1 { color: #667eea; }
                        </style>
                    </head>
                    <body>
                        <h1>404 - File Not Found</h1>
                        <p>The requested file could not be found.</p>
                        <p><a href="/">Go to Home</a></p>
                    </body>
                    </html>
                `, 'utf-8');
            } else {
                // Server error
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>500 - Server Error</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                            h1 { color: #e74c3c; }
                        </style>
                    </head>
                    <body>
                        <h1>500 - Server Error</h1>
                        <p>An error occurred while processing your request.</p>
                        <p><a href="/">Go to Home</a></p>
                    </body>
                    </html>
                `, 'utf-8');
            }
        } else {
            // Success - serve the file
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log('\n🚀 Urgent Travel Server Started!');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📍 Server running at: http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${PROJECT_ROOT}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('\n✨ Open your browser and visit:');
    console.log(`   http://localhost:${PORT}\n`);
    console.log('⏹️  Press Ctrl+C to stop the server\n');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down server...');
    server.close(() => {
        console.log('✅ Server stopped.');
        process.exit(0);
    });
});

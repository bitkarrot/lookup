#!/usr/bin/env python3
"""
Simple HTTP server to serve the awesome-nostr HTML table and CSV data.
This solves the CORS issue when loading CSV files from local filesystem.
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to allow local file access
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def serve_directory(directory='.', port=8000):
    """Serve the specified directory on the given port."""
    
    # Change to the specified directory
    os.chdir(directory)
    
    # Create the server
    with socketserver.TCPServer(("", port), CustomHTTPRequestHandler) as httpd:
        print(f"🚀 Serving awesome-nostr directory at http://localhost:{port}")
        print(f"📁 Directory: {os.getcwd()}")
        print(f"🌐 Open http://localhost:{port}/awesome-nostr-table.html in your browser")
        print("Press Ctrl+C to stop the server")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")

if __name__ == "__main__":
    # Get port from command line argument or use default
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Invalid port number. Using default port 8000.")
    
    # Check if we're in the right directory
    current_dir = Path.cwd()
    if not (current_dir / "awesome-nostr.csv").exists():
        print("❌ awesome-nostr.csv not found in current directory!")
        print(f"Current directory: {current_dir}")
        print("Please run this script from the directory containing awesome-nostr.csv")
        sys.exit(1)
    
    if not (current_dir / "awesome-nostr-table.html").exists():
        print("❌ awesome-nostr-table.html not found in current directory!")
        print("Please make sure the HTML file exists in the same directory.")
        sys.exit(1)
    
    serve_directory(port=port)

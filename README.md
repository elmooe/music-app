


# Music Sharing Application

This application is designed to share **Serum FXP files** and **Samples** as URL links centrally among friends. It is tailored for music creators, making it easier for them to share and collaborate on music production assets. The application also allows users to **play downloaded music files** directly through the user interface.

## Key Features
- Share **Serum FXP files** and **samples** from internet as links.
- Built-in **audio player** for previewing music files directly within the application.
- Centralized platform for sharing **VST presets**.

## Built With
- **Rust**: Backend development for performance and reliability.
- **Next.js**: Frontend framework for seamless and responsive user interfaces.

## Requirements
Ensure the following tools are installed before starting:
1. Rust and Cargo
Install Rust using rustup:

        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

2. Tauri CLI
Install tauri CLI globally

        cargo install tauri-cli

3. Node.js and Yarn
Install Node.js. Use the LTS version.
Install yarn globally:

        npm install -g yarn

## Setting Up the Firebase Project
This app integrates with Firebase for database functionality. Follow these steps to initialize Firebase:

Set Up Firebase

* Go to the Firebase Console and create a new project.
* Enable the Realtime Database and set the rules to allow authenticated access (or as per your project needs).
* Copy your Firebase Realtime Database URL.
Update Firebase Configuration
* Go to .env file
* Replace the FIREBASE_URL constant with your Firebase Realtime Database URL:

        const FIREBASE_URL: &str = "https://your-firebase-database-url.firebaseio.com/";

## Getting Started
Follow these steps to set up and run the app:

        git clone https://github.com/elmooe/music-app.git
        cd music-app

## Install dependencies

        Yarn install

## Start the app

        Yarn tauri dev

## Building the app
        Yarn tauri build
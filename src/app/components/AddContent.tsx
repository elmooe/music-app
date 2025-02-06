'use client';

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import styles from './AddContent.module.css';

const AddContent: React.FC = () => {
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);
    const [title, setTitle] = useState<string>('');
    const [url, setUrl] = useState<string>('');

    const handleFileSelect = async () => {
        try {
            const selected = await open({
                multiple: true,
                filters: [
                    { name: 'Audio Files', extensions: ['mp3', 'flac', 'wav'] },
                    { name: 'Preset Files', extensions: ['fxp'] }
                ]
            });

            if (!selected) {
                console.warn('No files selected');
                return;
            }

            const files = Array.isArray(selected) ? selected : [selected];
            console.log('Selected files:', files);

            for (const filePath of files) {
                if (typeof filePath === 'string') {
                    if (filePath.endsWith('.fxp')) {
                        console.log('Uploading preset file:', filePath);
                        await invoke('upload_preset_metadata', { filePath: filePath });
                    }
                } else {
                    console.warn('Invalid file path detected:', filePath);
                    setUploadStatus('Failed to upload some files.');
                }
            }

            setUploadStatus('Files uploaded successfully!');
        } catch (error) {
            console.error('Error uploading file:', error);
            setUploadStatus('Failed to upload files.');
        }
    };

    const handleSongSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!url) {
            setUploadStatus('URL is required.');
            return;
        }

        try {
            await invoke('upload_sample_metadata', {
                title: title || url,
                url: url,
            });

            setUploadStatus('Sample URL uploaded successfully!');
            setTitle('');
            setUrl('');
        } catch (error) {
            console.error('Failed to upload sample URL:', error);
            setUploadStatus('Failed to upload sample URL.');
        }
    };

    return (
        <div className={styles.container}>

        <h2>Upload Sample URL</h2>
            <div className={styles.addContentSection}>
                <form onSubmit={handleSongSubmit} className={styles.songForm}>
                    <div className={styles.formGroup}>
                        <label htmlFor="title">Title (Optional)</label>
                        <input
                            type="text"
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Enter title"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="url">URL</label>
                        <input
                            type="url"
                            id="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="Enter web URL"
                            required
                        />
                    </div>
                    <button type="submit" className={styles.submitButton}>
                        📤 Upload Sample
                    </button>
                </form>

                <h2>Upload FXP Files</h2>
                <h3>(for Serum)</h3>
                <div className={styles.manualUpload}>
                    <button onClick={handleFileSelect} className={styles.fileButton}>
                        📤 Select Files Manually
                    </button>
                </div>
                {uploadStatus && <p className={styles.status}>{uploadStatus}</p>}
            </div>
        </div>
    );
};

export default AddContent;
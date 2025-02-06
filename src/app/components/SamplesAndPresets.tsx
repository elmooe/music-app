'use client'

import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import React, { useEffect, useState } from "react";
import styles from "./SamplesAndPresets.module.css";
import { IoIosRefresh } from "react-icons/io";
import { IoMdDownload } from "react-icons/io";
import { open } from '@tauri-apps/plugin-shell';

interface Song {
    title: string;
    url: string;
    uploaded_by: string;
}

interface Preset {
    title: string;
    url: string;
    uploaded_by: string;
}

const MusicPlayer: React.FC = () => {
    const [samples, setSamples] = useState<Song[]>([]);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [listType, setListType] = useState<'samples' | 'presets'>('presets');
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const cachedSongs = await invoke<Song[]>('get_cached_samples');
                if (cachedSongs.length === 0) {
                    console.log('No cached samples found, refreshing...');
                    await refreshSongs();
                } else {
                    setSamples(cachedSongs);
                    console.log('Fetched cached samples from cache.');
                }

                const cachedPresets = await invoke<Preset[]>('get_cached_presets');
                if (cachedPresets.length === 0) {
                    console.log('No cached presets found, refreshing...');
                    await refreshPresets();
                } else {
                    setPresets(cachedPresets);
                    console.log('Fetched cached presets from cache.');
                }
            } catch (error) {
                console.error('Failed to load cached data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [listType]);

    const refreshSongs = async () => {
        setRefreshing(true);
        try {
            const fetchedSongs = await invoke<Song[]>('fetch_all_samples');
            setSamples(fetchedSongs);
            console.log('Fetched samples from server.');
        } catch (error) {
            console.error('Failed to fetch samples:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const refreshPresets = async () => {
        setRefreshing(true);
        try {
            const fetchedPresets = await invoke<Song[]>('fetch_all_presets');
            setPresets(fetchedPresets);
            console.log('Fetched presets from server.');
        } catch (error) {
            console.error('Failed to fetch presets:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        if (listType === 'samples') {
            refreshSongs();
        } else {
            refreshPresets();
        }
    };

    if (loading) {
        return <p>Loading data...</p>;
    }

    const playSong = async (song: Song) => {
        if (!song.url) {
            console.warn('No URL available for this song.');
            return;
        }

        try {
            await open(song.url);
            console.log(`Opened song URL in browser: ${song.url}`);
        } catch (error) {
            console.error('Failed to open song URL:', error);
        }
    };

    const downloadPreset = async (presetName: string) => {
        try {
            const outputPath = await save({
                defaultPath: `${presetName}`,
                filters: [
                    {
                        name: "FXP Preset",
                        extensions: ["fxp"],
                    },
                ],
            });
            if (!outputPath) {
                console.warn('Save operation was canceled by the user.');
                return;
            }
            await invoke('download_preset_file', {
                presetName: presetName,
                outputPath: outputPath,
            });
    
            console.log(`Preset downloaded to ${outputPath}`);
        } catch (error) {
            console.error('Failed to download preset:', error);
        }
    };

    const handleToggle = (type: 'samples' | 'presets') => {
        setListType(type);
    };

    const displayedItems = listType === 'samples' ? samples : presets;

    return (
        <div className={styles.container}>
            <div className={styles.buttonGroup}>
                <div className={styles.leftButtons}>
                    <button 
                        onClick={() => handleToggle('samples')} 
                        className={listType === 'samples' ? styles.activeButton : ''}>sample URLs
                    </button>
                    <button 
                        onClick={() => handleToggle('presets')} 
                        className={listType === 'presets' ? styles.activeButton : ''}>Presets
                    </button>
                </div>
                <div className={styles.rightButton}>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className={styles.refreshButton}>
                        <IoIosRefresh className={`${styles.refreshIcon} ${refreshing ? styles.spin : ''}`} />
                    </button>
                </div>
            
            </div>
            <div className={styles.listBg}>
                <div className={styles.songList}>
                    <ul>
                    {displayedItems.map((item) => (
                        <li key={item.title} onClick={() => playSong(item)} className={styles.songItem}>
                            <span className={styles.songTitle}>
                                {item.title}
                            </span>
                            {listType === 'presets' && (
                                <button
                                    onClick={() => downloadPreset(item.title)}
                                    className={styles.downloadButton}
                                >
                                    <IoMdDownload />
                                </button>
                            )}
                        </li>
                    ))}
                    </ul>
                </div>
            </div>
        </div>
    );
    
};

export default MusicPlayer;
'use client'

import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import React, { useEffect, useState } from "react";
import styles from "./SamplesAndPresets.module.css";
import { IoIosRefresh } from "react-icons/io";
import { IoMdDownload } from "react-icons/io";
import { open } from '@tauri-apps/plugin-shell';
import { IoIosArrowDown } from "react-icons/io";
import { IoMdClose } from "react-icons/io";

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

type SortOption = 'name' | 'uploaded_by' | 'date';

const MusicPlayer: React.FC = () => {
    const [samples, setSamples] = useState<Song[]>([]);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [listType, setListType] = useState<'samples' | 'presets'>('presets');
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [sortBy, setSortBy] = useState<SortOption>('name');
    const [loggedInUser, setLoggedInUser] = useState<string | null>(null);

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

    useEffect(() => {
        invoke<string | null>('get_logged_in_user').then(user => {
            setLoggedInUser(user);
        });
    }, []);

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

    const getSortedItems = (items: (Song | Preset)[]) => {
        return [...items].sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.title.localeCompare(b.title);
                case 'uploaded_by':
                    return a.uploaded_by.localeCompare(b.uploaded_by);
                case 'date':
                    return 0;
                default:
                    return 0;
            }
        });
    };

    const displayedItems = getSortedItems(listType === 'samples' ? samples : presets);

    const removeSample = async (title: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await invoke('remove_sample_command', { title });
            await refreshSongs();
            setSamples(prev => prev.filter(sample => sample.title !== title));
            console.log(`Removed sample: ${title}`);
        } catch (error) {
            console.error('Failed to remove sample:', error);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.buttonGroup}>
                <div className={styles.leftButtons}>
                    <button 
                        onClick={() => handleToggle('samples')} 
                        className={listType === 'samples' ? styles.activeButton : ''}>
                        sample URLs
                    </button>
                    <button 
                        onClick={() => handleToggle('presets')} 
                        className={listType === 'presets' ? styles.activeButton : ''}>
                        Presets
                    </button>
                </div>
                <div className={styles.rightControls}>
                    <div className={styles.sortContainer}>
                        <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className={styles.sortSelect}
                        >
                            <option value="name">Sort Alphabetically</option>
                            <option value="uploaded_by">Sort by Uploader</option>
                            <option value="date">Sort by Date</option>
                        </select>
                        <IoIosArrowDown className={styles.sortIcon} />
                    </div>
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
                        <li key={item.title} onClick={() => playSong(item as Song)} className={styles.songItem}>
                            <span className={styles.songTitle}>
                                {item.title}
                            </span>
                            <div className={styles.rightControls}>
                                <span className={styles.uploadedBy}>{item.uploaded_by}</span>
                                {listType === 'presets' ? (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            downloadPreset(item.title);
                                        }}
                                        className={styles.downloadButton}
                                    >
                                        <IoMdDownload />
                                    </button>
                                ) : (
                                    item.uploaded_by === loggedInUser && (
                                        <button
                                            onClick={(e) => removeSample(item.title, e)}
                                            className={styles.deleteButton}
                                        >
                                            <IoMdClose />
                                        </button>
                                    )
                                )}
                            </div>
                        </li>
                    ))}
                    </ul>
                </div>
            </div>
        </div>
    );
    
};

export default MusicPlayer;
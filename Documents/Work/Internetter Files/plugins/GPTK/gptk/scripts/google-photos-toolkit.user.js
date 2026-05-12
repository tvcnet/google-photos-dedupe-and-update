// ==UserScript==
// @name        Google Photos Toolkit (GPTK)
// @description Advanced AI toolkit for Google Photos. Deduplicate, organize, and generate descriptions with Gemini or local Ollama.
// @version     4.5.0
// @author      Jim Walker, @TVCNet
// @homepageURL https://github.com/tvcnet/gptk#readme
// @supportURL  https://github.com/tvcnet/gptk/discussions
// @match       *://photos.google.com/*
// @license     MIT
// @namespace   https://github.com/tvcnet/gptk
// @run-at      body
// @grant       GM_registerMenuCommand
// @grant       unsafeWindow
// @noframes    
// ==/UserScript==
(function () {
    'use strict';

    /**
     * @typedef {Object} MediaItem
     * @property {string} mediaKey
     * @property {string} dedupKey
     * @property {string} [fileName]
     * @property {string} [description]
     * @property {string} [descriptionFull]
     * @property {number} [timestamp]
     * @property {number} [creationTimestamp]
     * @property {number} [size]
     * @property {number} [resWidth]
     * @property {number} [resHeight]
     * @property {boolean} [isOriginalQuality]
     * @property {boolean} [takesUpSpace]
     * @property {boolean} [isFavorite]
     * @property {boolean} [isArchived]
     * @property {boolean} [isLivePhoto]
     * @property {boolean} [isOwned]
     * @property {boolean} [isPartialUpload]
     * @property {string} [thumb]
     * @property {Object} [geoLocation]
     * @property {number[]} [geoLocation.coordinates]
     * @property {number} [duration]
     * @property {number} [timezoneOffset]
     */

    /**
     * @typedef {Object} Album
     * @property {string} mediaKey
     * @property {string} title
     * @property {number} [itemCount]
     * @property {boolean} [isShared]
     * @property {string} [authKey]
     */

    /**
     * @typedef {Object} FilterSettings
     * @property {string} [fileNameRegex]
     * @property {string} [fileNameMatchType]
     * @property {string} [searchQuery]
     * @property {string} [descriptionRegex]
     * @property {string} [descriptionMatchType]
     * @property {string} [higherBoundarySize]
     * @property {string} [lowerBoundarySize]
     * @property {string} [minWidth]
     * @property {string} [maxWidth]
     * @property {string} [minHeight]
     * @property {string} [maxHeight]
     * @property {string} [quality]
     * @property {string} [space]
     * @property {string} [lowerBoundaryDate]
     * @property {string} [higherBoundaryDate]
     * @property {string} [intervalType]
     * @property {string} [dateType]
     * @property {string} [type]
     * @property {string} [favorite]
     * @property {boolean} [excludeFavorites]
     * @property {string} [hasLocation]
     * @property {string} [boundSouth]
     * @property {string} [boundWest]
     * @property {string} [boundNorth]
     * @property {string} [boundEast]
     * @property {string} [owned]
     * @property {string} [uploadStatus]
     * @property {string} [archived]
     */

    /**
     * @typedef {Object} ApiSettings
     * @property {number} maxConcurrentSingleApiReq
     * @property {number} maxConcurrentBatchApiReq
     * @property {number} operationSize
     * @property {number} lockedFolderOpSize
     * @property {number} infoSize
     * @property {string} aiProvider
     * @property {string} geminiApiKey - redacted in the page context
     * @property {boolean} hasGeminiApiKey
     * @property {number} geminiDelayMs
     * @property {string} ollamaBaseUrl
     * @property {string} ollamaModel
     * @property {string[]} ollamaModels
     * @property {number} ollamaDelayMs
     * @property {string} ollamaApiKey - redacted in the page context
     * @property {boolean} hasOllamaApiKey
     */

    let extSettings = {};
    let extSettingsReady = false;

    function normalizeExtensionSettings(settings) {
        const normalized = {
            ...apiSettingsDefault,
            ...(settings ?? {}),
        };
        if (!['gemini', 'ollama'].includes(normalized.aiProvider)) {
            normalized.aiProvider = apiSettingsDefault.aiProvider;
        }
        if (!Array.isArray(normalized.ollamaModels)) {
            normalized.ollamaModels = [];
        }
        return normalized;
    }

    function syncExtensionSettingsToPanel() {
        const providerInput = document.querySelector('select[name="aiProvider"]');
        if (providerInput && document.activeElement !== providerInput) {
            providerInput.value = extSettings.aiProvider ?? apiSettingsDefault.aiProvider;
        }
        const delayInput = document.querySelector('input[name="geminiDelayMs"]');
        if (delayInput && document.activeElement !== delayInput) {
            delayInput.value = String(extSettings.geminiDelayMs ?? apiSettingsDefault.geminiDelayMs);
        }
        const ollamaBaseUrlInput = document.querySelector('select[name="ollamaBaseUrl"]');
        if (ollamaBaseUrlInput && document.activeElement !== ollamaBaseUrlInput) {
            ollamaBaseUrlInput.value = extSettings.ollamaBaseUrl ?? apiSettingsDefault.ollamaBaseUrl;
        }
        populateOllamaModelOptions(extSettings.ollamaModels ?? []);
        const ollamaModelInput = document.querySelector('select[name="ollamaModel"]');
        if (ollamaModelInput && document.activeElement !== ollamaModelInput) {
            const currentModel = extSettings.ollamaModel ?? '';
            if (currentModel && !(extSettings.ollamaModels ?? []).includes(currentModel)) {
                const option = document.createElement('option');
                option.value = currentModel;
                option.textContent = currentModel;
                ollamaModelInput.appendChild(option);
            }
            ollamaModelInput.value = currentModel;
        }
        const ollamaDelayInput = document.querySelector('input[name="ollamaDelayMs"]');
        if (ollamaDelayInput && document.activeElement !== ollamaDelayInput) {
            ollamaDelayInput.value = String(extSettings.ollamaDelayMs ?? apiSettingsDefault.ollamaDelayMs);
        }
        updateAiProviderSettingsVisibility();
    }

    // Request settings from extension storage via bridge
    window.postMessage({ app: 'GPD', action: 'gptkGetStorage' }, '*');

    // Listen for settings from bridge
    window.addEventListener('message', (e) => {
        if (e.source !== window) return;
        const msg = e.data;
        if (msg?.app === 'GPD' && msg.action === 'gptkStorageData') {
            console.log('GPD: Received settings from extension storage');
            extSettings = normalizeExtensionSettings(msg.data);
            extSettingsReady = true;
            syncExtensionSettingsToPanel();
        }
    });



    var gptkMainTemplate = (`
<div class="overlay"></div>
<div id="gptk" class="container">

  <!-- ── HEADER ─────────────────────────────────── -->
  <div class="header">
    <div class="header-info">
      <div class="header-icon">
        <svg width="18" height="18" viewBox="0 0 17 17" fill="currentColor">
          <path d="M6.838,11.784 L12.744,5.879 C13.916,6.484 15.311,6.372 16.207,5.477 C16.897,4.786 17.131,3.795 16.923,2.839 L15.401,4.358 L14.045,4.624 L12.404,2.999 L12.686,1.603 L14.195,0.113 C13.24,-0.095 12.248,0.136 11.557,0.827 C10.661,1.723 10.549,3.117 11.155,4.291 L5.249,10.197 C4.076,9.592 2.681,9.705 1.784,10.599 C1.096,11.29 0.862,12.281 1.069,13.236 L2.592,11.717 L3.947,11.452 L5.59,13.077 L5.306,14.473 L3.797,15.963 C4.752,16.17 5.744,15.94 6.434,15.249 C7.33,14.354 7.443,12.958 6.838,11.784 Z"></path>
        </svg>
      </div>
      <div class="header-text">GPTK</div>
    </div>
    <div class="header-steps">
      <span class="step-badge">1</span> Source
      <span class="step-arrow">&rarr;</span>
      <span class="step-badge">2</span> Filter
      <span class="step-arrow">&rarr;</span>
      <span class="step-badge">3</span> Action
    </div>
    <div id="hide" title="Close the GPTK Panel">
      <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
    </div>
  </div>

  <!-- ── BODY: LEFT PANEL (Source + Filters) | RIGHT PANEL (Actions + Log) ── -->
  <div class="window-body">

    <!-- ─── LEFT: Source → Filters ────────────── -->
    <div class="sidebar scroll">

      <!-- STEP 1: Source -->
      <div class="panel-section">
        <div class="section-label">
          <span class="step-badge">1</span> Select Source
          <span class="help-tooltip" tabindex="0" data-help="Choose where the toolkit should find photos to process. You can select your full Library, an Album collection, or use Google's search engine to find specific items."> (?)</span>
        </div>
        <div class="sources">
          <div class="source">
            <input type="radio" name="source" id="library" class="sourceHeaderInput" checked="checked">
            <label class="sourceHeader" for="library">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-7l-3 3.72L9 13l-3 4h12l-4-5z"></path></svg>
              Library
            </label>
          </div>
          <div class="source">
            <input type="radio" name="source" id="search" class="sourceHeaderInput">
            <label class="sourceHeader" for="search">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M20.49 19l-5.73-5.73C15.53 12.2 16 10.91 16 9.5A6.5 6.5 0 1 0 9.5 16c1.41 0 2.7-.47 3.77-1.24L19 20.49 20.49 19zM5 9.5C5 7.01 7.01 5 9.5 5S14 7.01 14 9.5 11.99 14 9.5 14 5 11.99 5 9.5z"></path></svg>
              Search
            </label>
          </div>
          <div class="source">
            <input type="radio" name="source" id="albums" class="sourceHeaderInput">
            <label class="sourceHeader" for="albums">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V4h6v7l2.5-1.88L17 11V4h1v16zm-4.33-6L17 18H7l2.5-3.2 1.67 2.18 2.5-2.98z"></path></svg>
              Albums
            </label>
          </div>
          <div class="source">
            <input type="radio" name="source" id="sharedLinks" class="sourceHeaderInput">
            <label class="sourceHeader" for="sharedLinks">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z"></path></svg>
              Shared
            </label>
          </div>
          <div class="source">
            <input type="radio" name="source" id="favorites" class="sourceHeaderInput">
            <label class="sourceHeader" for="favorites">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"></path></svg>
              Favorites
            </label>
          </div>
          <div class="source">
            <input type="radio" name="source" id="lockedFolder" class="sourceHeaderInput">
            <label class="sourceHeader" for="lockedFolder">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"></path></svg>
              Locked
            </label>
          </div>
        </div>
      </div>

      <!-- STEP 2: Filters -->
      <div class="panel-section">
        <div class="section-label">
          <span class="step-badge">2</span> Filters
          <span class="help-tooltip" tabindex="0" data-help="Narrow down your selection. These rules let you target specific photos by date, resolution, file type, or even visual similarity before you run an action."> (?)</span>
          <div class="flex centered" title="Clear all applied filters and reset to default" id="filterResetButton">
            <svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 -960 960 960" width="14"><path d="M440-122q-121-15-200.5-105.5T160-440q0-66 26-126.5T260-672l57 57q-38 34-57.5 79T240-440q0 88 56 155.5T440-202v80Zm80 0v-80q87-16 143.5-83T720-440q0-100-70-170t-170-70h-3l44 44-56 56-140-140 140-140 56 56-44 44h3q134 0 227 93t93 227q0 121-79.5 211.5T520-122Z"/></svg>
            Reset
          </div>
        </div>
      </div>

      <form class="filters-form">
        <details open class="include-albums">
          <summary>Select Albums</summary>
          <fieldset>
            <select size="5" multiple="multiple" class="select-multiple albums-select scroll" name="albumsInclude" required>
              <option value="" title="Click the refresh button below to load your Google Photos albums">Press Refresh</option>
            </select>
            <div class="select-control-buttons-row">
              <div class="refresh-albums svg-container" title="Fetch the latest list of your albums from Google Photos">
                <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M482-160q-134 0-228-93t-94-227v-7l-64 64-56-56 160-160 160 160-56 56-64-64v7q0 100 70.5 170T482-240q26 0 51-6t49-18l60 60q-38 22-78 33t-82 11Zm278-161L600-481l56-56 64 64v-7q0-100-70.5-170T478-720q-26 0-51 6t-49 18l-60-60q38-22 78-33t82-11q134 0 228 93t94 227v7l64-64 56 56-160 160Z"></path></svg>
              </div>
              <button type="button" name="selectAll" title="Select all albums in the list below">All</button>
              <button type="button" name="resetAlbumSelection" title="Deselect all albums">Reset</button>
            </div>
            <div class="select-control-buttons-row">
              <button type="button" name="selectShared" title="Select only albums that are shared with other users">Shared</button>
              <button type="button" name="selectNonShared" title="Select only your private, non-shared albums">Non-Shared</button>
            </div>
          </fieldset>
        </details>

        <details open class="search">
          <summary>Search</summary>
          <fieldset>
            <label class="form-control">
              <legend>Search Query:</legend>
              <input name="searchQuery" value="" type="input" placeholder="Enter search query..." required>
            </label>
          </fieldset>
        </details>

        <details class="exclude-albums"><summary>Exclude Albums</summary><fieldset>
          <select size="5" multiple="multiple" class="select-multiple albums-select scroll" name="albumsExclude"><option value="" title="Click the refresh button below to load your Google Photos albums">Press Refresh</option></select>
          <div class="select-control-buttons-row">
            <div class="refresh-albums svg-container" title="Fetch the latest list of your albums from Google Photos"><svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20"><path d="M482-160q-134 0-228-93t-94-227v-7l-64 64-56-56 160-160 160 160-56 56-64-64v7q0 100 70.5 170T482-240q26 0 51-6t49-18l60 60q-38 22-78 33t-82 11Zm278-161L600-481l56-56 64 64v-7q0-100-70.5-170T478-720q-26 0-51 6t-49 18l-60-60q38-22 78-33t82-11q134 0 228 93t94 227v7l64-64 56 56-160 160Z"></path></svg></div>
            <button type="button" name="selectAll" title="Select all albums in the list below">All</button>
            <button type="button" name="resetAlbumSelection" title="Deselect all albums">Reset</button>
          </div>
          <div class="select-control-buttons-row">
            <button type="button" name="selectShared" title="Select only albums that are shared with other users">Shared</button>
            <button type="button" name="selectNonShared" title="Select only your private, non-shared albums">Non-Shared</button>
          </div>
        </fieldset></details>

        <details class="date-interval"><summary>Date Interval</summary><fieldset>
          <legend>From:</legend>
          <div class="flex centered input-wrapper">
            <input type="datetime-local" name="lowerBoundaryDate">
            <div class="date-reset flex centered" title="Reset this date field" name="dateReset"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><path d="M 13.7851 49.5742 L 42.2382 49.5742 C 47.1366 49.5742 49.5743 47.1367 49.5743 42.3086 L 49.5743 13.6914 C 49.5743 8.8633 47.1366 6.4258 42.2382 6.4258 L 13.7851 6.4258 C 8.9101 6.4258 6.4257 8.8398 6.4257 13.6914 L 6.4257 42.3086 C 6.4257 47.1602 8.9101 49.5742 13.7851 49.5742 Z M 19.6913 38.3711 C 18.5429 38.3711 17.5820 37.4336 17.5820 36.2852 C 17.5820 35.7461 17.8163 35.2305 18.2382 34.8086 L 25.0351 27.9649 L 18.2382 21.1445 C 17.8163 20.7227 17.5820 20.2071 17.5820 19.6680 C 17.5820 18.4961 18.5429 17.5352 19.6913 17.5352 C 20.2539 17.5352 20.7460 17.7461 21.1679 18.1680 L 28.0117 25.0118 L 34.8554 18.1680 C 35.2539 17.7461 35.7695 17.5352 36.3085 17.5352 C 37.4804 17.5352 38.4413 18.4961 38.4413 19.6680 C 38.4413 20.2071 38.2070 20.7227 37.7851 21.1445 L 30.9648 27.9649 L 37.7851 34.8086 C 38.2070 35.2305 38.4413 35.7461 38.4413 36.2852 C 38.4413 37.4336 37.4804 38.3711 36.3085 38.3711 C 35.7695 38.3711 35.2539 38.1602 34.8788 37.7852 L 28.0117 30.8945 L 21.1444 37.7852 C 20.7460 38.1602 20.2773 38.3711 19.6913 38.3711 Z"/></svg></div>
          </div>
          <legend>To:</legend>
          <div class="flex centered input-wrapper">
            <input type="datetime-local" name="higherBoundaryDate">
            <div class="date-reset flex centered" title="Reset this date field" name="dateReset"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><path d="M 13.7851 49.5742 L 42.2382 49.5742 C 47.1366 49.5742 49.5743 47.1367 49.5743 42.3086 L 49.5743 13.6914 C 49.5743 8.8633 47.1366 6.4258 42.2382 6.4258 L 13.7851 6.4258 C 8.9101 6.4258 6.4257 8.8398 6.4257 13.6914 L 6.4257 42.3086 C 6.4257 47.1602 8.9101 49.5742 13.7851 49.5742 Z M 19.6913 38.3711 C 18.5429 38.3711 17.5820 37.4336 17.5820 36.2852 C 17.5820 35.7461 17.8163 35.2305 18.2382 34.8086 L 25.0351 27.9649 L 18.2382 21.1445 C 17.8163 20.7227 17.5820 20.2071 17.5820 19.6680 C 17.5820 18.4961 18.5429 17.5352 19.6913 17.5352 C 20.2539 17.5352 20.7460 17.7461 21.1679 18.1680 L 28.0117 25.0118 L 34.8554 18.1680 C 35.2539 17.7461 35.7695 17.5352 36.3085 17.5352 C 37.4804 17.5352 38.4413 18.4961 38.4413 19.6680 C 38.4413 20.2071 38.2070 20.7227 37.7851 21.1445 L 30.9648 27.9649 L 37.7851 34.8086 C 38.2070 35.2305 38.4413 35.7461 38.4413 36.2852 C 38.4413 37.4336 37.4804 38.3711 36.3085 38.3711 C 35.7695 38.3711 35.2539 38.1602 34.8788 37.7852 L 28.0117 30.8945 L 21.1444 37.7852 C 20.7460 38.1602 20.2773 38.3711 19.6913 38.3711 Z"/></svg></div>
          </div>
          <hr>
          <div class="radio-group">
            <label class="form-control"><input name="intervalType" type="radio" value="include" checked="checked"><span>Include</span></label>
            <label class="form-control"><input name="intervalType" type="radio" value="exclude"><span>Exclude</span></label>
          </div>
          <hr>
          <div class="radio-group">
            <label class="form-control"><input name="dateType" type="radio" value="taken" checked="checked"><span>Date Taken</span></label>
            <label class="form-control"><input name="dateType" type="radio" value="uploaded"><span>Date Uploaded</span></label>
          </div>
        </fieldset></details>

        <details class="filename"><summary>Filename</summary><fieldset>
          <label class="form-control"><legend>Regex:</legend><input name="fileNameRegex" value="" type="input" placeholder="e.g. \.png$"></label>
          <div class="radio-group">
            <label class="form-control"><input name="fileNameMatchType" value="include" type="radio" checked="checked"> Include</label>
            <label class="form-control"><input name="fileNameMatchType" value="exclude" type="radio"> Exclude</label>
          </div>
        </fieldset></details>

        <details class="description"><summary>Description</summary><fieldset>
          <div class="radio-group">
            <label class="form-control"><input name="descriptionStatus" value="" type="radio" checked="checked"> Any</label>
            <label class="form-control"><input name="descriptionStatus" value="has" type="radio"> Has Description</label>
            <label class="form-control"><input name="descriptionStatus" value="missing" type="radio"> Missing Description</label>
          </div>
          <hr>
          <label class="form-control"><legend>Regex:</legend><input name="descriptionRegex" value="" type="input" placeholder="e.g. vacation"></label>
          <div class="radio-group">
            <label class="form-control"><input name="descriptionMatchType" value="include" type="radio" checked="checked"> Include</label>
            <label class="form-control"><input name="descriptionMatchType" value="exclude" type="radio"> Exclude</label>
          </div>
        </fieldset></details>

        <details class="space"><summary>Space</summary><fieldset><div class="radio-group">
          <label class="form-control"><input name="space" value="" type="radio" checked="checked"> Any</label>
          <label class="form-control"><input name="space" value="consuming" type="radio"> Consuming</label>
          <label class="form-control"><input name="space" value="non-consuming" type="radio"> Non-Consuming</label>
        </div></fieldset></details>

        <details class="similarity"><summary>Similarity</summary>
          <fieldset><span class="filter-note">Finds and groups similar images together. Best used with action Add to Album.</span></fieldset>
          <fieldset><label class="form-control checkbox-control"><input name="albumOnlyDedupe" value="true" type="checkbox"><span>Album-only dedupe</span></label></fieldset>
          <fieldset>
            <legend>Threshold</legend><div class="input-wrapper"><input name="similarityThreshold" type="number" placeholder="0.95" step="0.01" max="1" min="0"></div>
            <legend>Image height</legend><div class="input-wrapper"><input name="imageHeight" type="number" placeholder="Pixels" value="16"></div>
          </fieldset>
        </details>

        <details class="size"><summary>Size</summary><fieldset>
          <legend>More Than</legend><div class="input-wrapper"><input name="lowerBoundarySize" type="number" placeholder="Bytes"></div>
          <legend>Less Than</legend><div class="input-wrapper"><input name="higherBoundarySize" type="number" placeholder="Bytes"></div>
        </fieldset></details>

        <details class="resolution"><summary>Resolution</summary><fieldset>
          <legend>Min Width</legend><div class="input-wrapper"><input name="minWidth" type="number" placeholder="Pixels"></div>
          <legend>Max Width</legend><div class="input-wrapper"><input name="maxWidth" type="number" placeholder="Pixels"></div>
          <legend>Min Height</legend><div class="input-wrapper"><input name="minHeight" type="number" placeholder="Pixels"></div>
          <legend>Max Height</legend><div class="input-wrapper"><input name="maxHeight" type="number" placeholder="Pixels"></div>
        </fieldset></details>

        <details class="quality"><summary>Quality</summary><fieldset><div class="radio-group">
          <label class="form-control"><input name="quality" value="" type="radio" checked="checked"> Any</label>
          <label class="form-control"><input name="quality" value="original" type="radio"> Original</label>
          <label class="form-control"><input name="quality" value="storage-saver" type="radio"> Storage Saver</label>
        </div></fieldset></details>

        <details class="type"><summary>Type</summary><fieldset><div class="radio-group">
          <label class="form-control"><input name="type" value="" type="radio" checked="checked"> Any</label>
          <label class="form-control"><input name="type" value="image" type="radio"> Image</label>
          <label class="form-control"><input name="type" value="video" type="radio"> Video</label>
          <label class="form-control"><input name="type" value="live" type="radio"> Live Photo</label>
        </div></fieldset></details>

        <details class="upload-status"><summary>Upload Status</summary><fieldset><div class="radio-group">
          <label class="form-control"><input name="uploadStatus" value="" type="radio" checked="checked"> Any</label>
          <label class="form-control"><input name="uploadStatus" value="full" type="radio"> Full</label>
          <label class="form-control"><input name="uploadStatus" value="partial" type="radio"> Partial</label>
        </div></fieldset></details>

        <details class="archive"><summary>Archived</summary><fieldset><div class="radio-group">
          <label class="form-control"><input name="archived" value="" type="radio" checked="checked"> Any</label>
          <label class="form-control"><input name="archived" value="true" type="radio"> Yes</label>
          <label class="form-control"><input name="archived" value="false" type="radio"> No</label>
        </div></fieldset></details>

        <details class="owned"><summary>Ownership</summary><fieldset><div class="radio-group">
          <label class="form-control"><input name="owned" value="" type="radio" checked="checked"> Any</label>
          <label class="form-control"><input name="owned" value="true" type="radio"> Owned</label>
          <label class="form-control"><input name="owned" value="false" type="radio"> Not Owned</label>
        </div></fieldset></details>

        <details class="location"><summary>Location</summary><fieldset><div class="radio-group">
          <label class="form-control"><input name="hasLocation" value="" type="radio" checked="checked"> Any</label>
          <label class="form-control"><input name="hasLocation" value="true" type="radio"> Has Location</label>
          <label class="form-control"><input name="hasLocation" value="false" type="radio"> No Location</label>
        </div></fieldset>
        <fieldset>
          <legend>Bounding Box (optional)</legend>
          <span class="filter-note">Only items within this area are kept. Use decimal degrees (e.g. 48.85 for Paris).</span>
          <legend>South Latitude</legend><div class="input-wrapper"><input name="boundSouth" type="number" placeholder="-90 to 90" step="any" min="-90" max="90"></div>
          <legend>West Longitude</legend><div class="input-wrapper"><input name="boundWest" type="number" placeholder="-180 to 180" step="any" min="-180" max="180"></div>
          <legend>North Latitude</legend><div class="input-wrapper"><input name="boundNorth" type="number" placeholder="-90 to 90" step="any" min="-90" max="90"></div>
          <legend>East Longitude</legend><div class="input-wrapper"><input name="boundEast" type="number" placeholder="-180 to 180" step="any" min="-180" max="180"></div>
        </fieldset></details>

        <details class="favorite"><summary>Favorite</summary><fieldset><div class="radio-group">
          <label class="form-control"><input name="favorite" value="" type="radio" checked="checked"> Any</label>
          <label class="form-control"><input name="favorite" value="true" type="radio"> Yes</label>
          <label class="form-control"><input name="favorite" value="false" type="radio"> No</label>
        </div></fieldset></details>

        <hr>
        <fieldset class="exclude-shared"><label class="form-control checkbox-control"><input name="excludeShared" value="true" type="checkbox"><span>Exclude Shared Links</span></label></fieldset>
        <fieldset class="exclude-favorites"><label class="form-control checkbox-control"><input name="excludeFavorites" value="true" type="checkbox"><span>Exclude Favorites</span></label></fieldset>
        <fieldset class="sort-by-size"><label class="form-control checkbox-control"><input name="sortBySize" value="true" type="checkbox"><span>Sort by size</span></label></fieldset>
      </form>

      <form class="settings-form">
        <details class="settings"><summary>Advanced Settings</summary><fieldset>
          <legend>Max Concurrent Per-Item Requests</legend><div class="input-wrapper"><input name="maxConcurrentSingleApiReq" value="30" min="1" type="number" required></div>
          <legend>Max Concurrent Bulk Requests</legend><div class="input-wrapper"><input name="maxConcurrentBatchApiReq" value="3" min="1" type="number" required></div>
          <legend>API Operation Batch Size</legend><div class="input-wrapper"><input name="operationSize" value="250" max="500" min="1" type="number" required></div>
          <legend>Locked Folder API Operation Size</legend><div class="input-wrapper"><input name="lockedFolderOpSize" value="100" max="100" min="1" type="number" required></div>
          <legend>Bulk Info API Batch Size</legend><div class="input-wrapper"><input name="infoSize" value="5000" max="10000" min="1" type="number" required></div>
          <legend style="position: relative; display: flex; align-items: center; gap: 8px;">Choose Your Model <span class="help-tooltip" tabindex="0" data-help="Select between cloud-based Gemini or a local Ollama model for AI features. To use Gemini, you must set your API key in the GPTK dashboard (accessible via the extension icon). Ollama runs locally on your machine for enhanced privacy."> (?)</span></legend><div class="input-wrapper"><select name="aiProvider"><option value="gemini">Gemini</option><option value="ollama">Ollama Local</option></select></div>
          <div data-ai-provider-section="gemini">
            <p class="settings-note">Gemini keys are stored in extension storage. Use the extension hub to save or clear the key.</p>
            <legend>Gemini Delay Between Calls (ms)</legend><div class="input-wrapper"><input name="geminiDelayMs" value="4000" min="0" max="60000" type="number" required></div>
          </div>
          <div data-ai-provider-section="ollama">
            <legend>Ollama Local Server</legend><div class="input-wrapper"><select name="ollamaBaseUrl"><option value="http://127.0.0.1:11434">http://127.0.0.1:11434</option><option value="http://localhost:11434">http://localhost:11434</option></select></div>
            <legend>Ollama Model</legend><div class="input-wrapper"><select name="ollamaModel" id="ollamaModels"><option value="">Fetch a model...</option></select><button type="button" name="fetchOllamaModels">Fetch Models</button></div>
            <p class="settings-note">Standard local Ollama does not require an API key. If a proxy key is already stored, GPTK uses it from extension storage without exposing it to Google Photos.</p>
            <legend>Ollama Delay Between Calls (ms)</legend><div class="input-wrapper"><input name="ollamaDelayMs" value="1000" min="0" max="60000" type="number" required></div>
          </div>
          <div class="settings-controls">
            <button name="save" type="submit" class="btn-primary">Save</button>
            <button name="default">Default</button>
          </div>
        </fieldset></details>
      </form>
    </div>

    <!-- ─── RIGHT: Actions + Log ─────────────── -->
    <div class="main">

      <!-- STEP 3: Actions -->
      <div class="action-bar">
        <div class="section-label">
          <span class="step-badge">3</span> Choose Action
          <span class="help-tooltip" tabindex="0" data-help="Select what you want to do with the filtered photos. You can move them, toggle favorites, or use your chosen AI model to generate descriptive captions."> (?)</span>
        </div>
        <div class="action-categories">
          <!-- Smart Albums & Organization -->
          <div class="action-group">
            <h4 class="action-group-title">📂 Smart Albums & Organization</h4>
            <div class="action-buttons-grid">
              <button id="showExistingAlbumForm" title="Move the selected items into an existing Google Photos album">Add to Album</button>
              <button type="button" id="toArchive" title="Move the filtered photos into your Archive">Archive</button>
              <button type="button" id="unArchive" title="Un-archive the filtered photos (return them to the main grid)">Un-Archive</button>
              <button type="button" id="toFavorite" title="Mark the filtered photos as Favorites">Favorite</button>
              <button type="button" id="unFavorite" title="Remove the Favorite status from the filtered photos">Un-Favorite</button>
              <button type="button" id="lock" title="Move the filtered photos into your highly secure Locked Folder">Lock</button>
              <button type="button" id="unLock" title="Remove the filtered photos from the Locked Folder">Unlock</button>
            </div>
          </div>

          <!-- Metadata Cleanup -->
          <div class="action-group">
            <h4 class="action-group-title">🧹 Metadata Cleanup</h4>
            <div class="action-buttons-grid">
              <button type="button" id="setDateFromFilename" title="Attempt to parse dates from the filename and update the photo's internal date metadata">Date from Name</button>
              <button type="button" id="copyDescFromOther" title="Extract original EXIF caption metadata and copy it into the Google Photos description field">Copy EXIF Desc</button>
              <button type="button" id="clearDescriptions" title="Remove all descriptions from the filtered photos">Clear Descriptions</button>
            </div>
          </div>

          <!-- AI Features -->
          <div class="action-group">
            <h4 class="action-group-title">✨ AI Features</h4>
            <div class="action-buttons-grid">
              <button type="button" id="aiDescribe" class="btn-ai" title="Use the selected AI provider to analyze images and generate descriptive captions automatically">AI Describe</button>
            </div>
          </div>
        </div>
        <div class="to-existing-container">
          <form id="toExistingAlbum" class="album-form" title="Select an existing album and add the currently filtered photos to it">
            <div class="refresh-albums svg-container" title="Fetch the latest list of your albums from Google Photos"><svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 -960 960 960" width="22"><path d="M482-160q-134 0-228-93t-94-227v-7l-64 64-56-56 160-160 160 160-56 56-64-64v7q0 100 70.5 170T482-240q26 0 51-6t49-18l60 60q-38 22-78 33t-82 11Zm278-161L600-481l56-56 64 64v-7q0-100-70.5-170T478-720q-26 0-51 6t-49 18l-60-60q38-22 78-33t82-11q134 0 228 93t94 227v7l64-64 56 56-160 160Z"/></svg></div>
            <select id="existingAlbum" class="dropdown albums-select" name="targetAlbumMediaKeyExisting" required><option value="">Press Refresh</option></select>
            <button type="submit" class="btn-primary">Add</button>
          </form>
          <button class="return" title="Return to the main list of actions">&larr; Back</button>
        </div>
      </div>

      <!-- Filter preview + Log -->
      <div class="filter-preview" title="This shows a summary of your currently active filters">
        <span>Filter: None</span>
      </div>
      <div class="button-container">
        <button id="stopProcess">Stop</button>
        <button id="clearLog">Clear Log</button>
      </div>
      <div id="logArea" class="logarea scroll"></div>
    </div>
  </div>

  <!-- ── FOOTER ─────────────────────────────────── -->
  <div class="footer">
    <div class="info-container"><a class="homepage-link" href="%homepage%" target="_blank">%version%</a></div>
    <div class="auto-scroll-container">
      <label for="autoScroll"><input type="checkbox" id="autoScroll" checked="checked"><span>Auto-scroll</span></label>
    </div>
  </div>
</div>

`);

    var buttonHtml = (`
<div
  id="gptk-button"
  role="button"
  class="U26fgb JRtysb WzwrXb YI2CVc G6iPcb"
  aria-label="GPTK"
  aria-disabled="false"
  tabindex="0"
  data-tooltip="Google Photos Toolkit"
  aria-haspopup="true"
  aria-expanded="false"
  data-dynamic="true"
  data-alignright="true"
  data-aligntop="true"
  data-tooltip-vertical-offset="-12"
  data-tooltip-horizontal-offset="0"
  style="transition: opacity 0.15s ease;"
>
  <div class="NWlf3e MbhUzd" jsname="ksKsZd"></div>
  <span jsslot="" class="MhXXcc oJeWuf"
    ><span class="Lw7GHd snByac">
      <svg width="24px" height="24px" viewBox="0 0 24 24" style="fill: #1a9fff">
        <g xmlns="http://www.w3.org/2000/svg" stroke-width="1" transform="translate(3.0, 3.95)">
          <path
            d="M6.838,11.784 L12.744,5.879 C13.916,6.484 15.311,6.372 16.207,5.477 C16.897,4.786 17.131,3.795 16.923,2.839 L15.401,4.358 L14.045,4.624 L12.404,2.999 L12.686,1.603 L14.195,0.113 C13.24,-0.095 12.248,0.136 11.557,0.827 C10.661,1.723 10.549,3.117 11.155,4.291 L5.249,10.197 C4.076,9.592 2.681,9.705 1.784,10.599 C1.096,11.29 0.862,12.281 1.069,13.236 L2.592,11.717 L3.947,11.452 L5.59,13.077 L5.306,14.473 L3.797,15.963 C4.752,16.17 5.744,15.94 6.434,15.249 C7.33,14.354 7.443,12.958 6.838,11.784 L6.838,11.784 Z"
          ></path>
        </g>
      </svg>
      <div class="oK50pe eLNT1d" aria-hidden="true" jsname="JjzL4d"></div></span
  ></span>
</div>

`);

    var css = (`
/* ================================================================
   Google Photos Toolkit — TVCNet Sky Glass Theme
   ================================================================ */
:root {
    /* Accent — TVCNet sky-500 palette (unchanged) */
    --accent: #0ea5e9;
    --accent-hover: #38bdf8;
    --accent-muted: rgba(14, 165, 233, 0.12);
    --accent-glow: rgba(14, 165, 233, 0.20);
    /* Sky-Glass surfaces — light frosted glass */
    --bg-base: rgba(240, 249, 255, 0.92);         /* sky-50 tinted */
    --bg-raised: rgba(255, 255, 255, 0.80);
    --bg-overlay: rgba(255, 255, 255, 0.65);
    --bg-surface: rgba(14, 165, 233, 0.06);
    --bg-surface-hover: rgba(14, 165, 233, 0.10);
    --bg-surface-active: rgba(14, 165, 233, 0.15);
    /* Glass surfaces */
    --glass-sidebar: rgba(255, 255, 255, 0.60);
    --glass-header: rgba(224, 242, 254, 0.85);    /* sky-100 */
    /* Borders */
    --border-subtle: rgba(12, 74, 110, 0.08);
    --border-default: rgba(12, 74, 110, 0.14);
    --border-strong: rgba(12, 74, 110, 0.22);
    --border-accent: rgba(14, 165, 233, 0.35);
    /* Text — sky-900 / sky-700 / sky-500 scale */
    --text-primary: #0c4a6e;
    --text-secondary: #0369a1;
    --text-tertiary: #0ea5e9;   /* Increased contrast from sky-300 to sky-500 */
    --text-disabled: #bae6fd;
    /* Semantic */
    --danger: #ef4444;
    --danger-muted: rgba(239, 68, 68, 0.10);
    --danger-hover: #f87171;
    --success: #10b981;
    --warning-text: #f59e0b;
    /* Overlay backdrop */
    --overlay-filter: blur(16px) brightness(0.90) saturate(1.1);
    /* Tokens */
    --radius-xs: 4px;
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;
    --ease: cubic-bezier(0.4, 0, 0.2, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --duration-fast: 0.12s;
    --duration: 0.2s;
    --shadow-panel: 0 24px 80px rgba(12, 74, 110, 0.18),
                     0 0 0 1px var(--border-subtle),
                     inset 0 1px 0 rgba(255, 255, 255, 0.6);
    --shadow-accent: 0 4px 20px rgba(14, 165, 233, 0.25);
}

/* ============================================
   OVERLAY
   ============================================ */
.overlay { position: absolute; display: none; left: 0; top: 0; width: 100%; height: 100%; z-index: 499; backdrop-filter: var(--overlay-filter); -webkit-backdrop-filter: var(--overlay-filter); transition: opacity var(--duration) var(--ease); }

/* ============================================
   RESPONSIVE
   ============================================ */
@media only screen and (min-width: 700px) { .window-body { display: grid; grid-template-columns: 300px 1fr; } }
@media only screen and (max-width: 700px) {
    .window-body { display: flex; flex-direction: column; }
    #gptk { top: 0% !important; bottom: 0% !important; width: 100% !important; border-radius: 0 !important; }
    #gptk .header-steps { display: none; }
    #gptk .sidebar { flex: 1 1 0; min-height: 0; border-right: none; }
    #gptk .main { flex: 0 0 auto; height: auto !important; max-height: 40vh !important; border-top: 1px solid var(--border-subtle); }
    #gptk #logArea { max-height: 20vh; }
}

/* ============================================
   KEYFRAMES
   ============================================ */
@keyframes pulse-running {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(14,165,233,0.4); }
    50% { opacity: 0.8; box-shadow: 0 0 0 5px rgba(14,165,233,0); }
}
@keyframes gptk-shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
}
@keyframes gptk-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes gptk-pill-glow {
    0% { box-shadow: 0 0 0 0 rgba(14,165,233,0.45); }
    100% { box-shadow: 0 0 0 7px rgba(14,165,233,0); }
}
@keyframes gptk-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
/* Modal entrance — matching tst-modal-in reference pattern */
@keyframes gptk-modal-in {
    from { opacity: 0; transform: scale(0.9) translateY(10px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* ============================================
   MAIN CONTAINER
   ============================================ */
#gptk {
    position: fixed; top: 4%; left: 50%; transform: translateX(-50%);
    width: 92%; bottom: 4%; min-height: 300px; max-width: 1280px; min-width: 300px;
    z-index: 500;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px; line-height: 1.4; padding: 0;
    display: none; flex-direction: column; cursor: default;
    border-radius: var(--radius-xl); color-scheme: light;
    background: linear-gradient(160deg, rgba(224, 242, 254, 0.97) 0%, rgba(240, 249, 255, 0.96) 60%);
    backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    color: var(--text-primary);
    border: 1px solid rgba(255, 255, 255, 0.55);
    box-shadow: var(--shadow-panel);
    box-sizing: border-box; overflow: hidden;

    * { box-sizing: border-box; }
    .flex { display: flex; }
    .centered { align-items: center; }
    .grid { display: grid; }
    .columns { gap: 1px; margin-bottom: 1px; grid-auto-flow: column; }

    /* ── Global elements ──────────────────── */
    hr { border: none; margin: 0; width: 100%; border-bottom: 1px solid var(--border-subtle); }

    /* ── Confirm Modal ────────────────────── */
    .gptk-confirm-backdrop {
        position: absolute; inset: 0; z-index: 600;
        background: rgba(186, 230, 253, 0.40);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        animation: gptk-fadeUp 0.15s ease-out both;
    }
    .gptk-confirm-box {
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: var(--radius-xl);
        box-shadow: 0 24px 80px rgba(12, 74, 110, 0.20), 0 0 0 1px var(--border-subtle);
        padding: 20px 24px 16px;
        max-width: 420px; width: 90%;
        display: flex; flex-direction: column; gap: 14px;
        animation: gptk-modal-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    .gptk-confirm-title {
        font-size: 13px; font-weight: 700; color: var(--text-primary);
        letter-spacing: -0.01em;
    }
    .gptk-confirm-body {
        font-size: 12px; line-height: 1.6; color: var(--text-secondary);
        white-space: pre-wrap; word-break: break-word;
    }
    .gptk-confirm-body .confirm-warning {
        color: var(--danger); font-weight: 600;
    }
    .gptk-confirm-actions {
        display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px;
    }

    /* ── Buttons ──────────────────────────── */
    button {
        background: var(--bg-surface);
        color: var(--text-primary);
        cursor: pointer;
        border: 1px solid var(--border-default);
        align-items: center; display: inline-flex; gap: 5px;
        padding: 0 10px;
        border-radius: var(--radius-sm);
        height: 28px; font-size: 11.5px; font-weight: 500;
        letter-spacing: 0.02em; text-transform: uppercase; white-space: nowrap;
        transition: all var(--duration-fast) var(--ease);
        font-family: inherit;
        position: relative; overflow: hidden;
        svg { flex-shrink: 0; fill: currentColor; }
    }
    button::after {
        content: '';
        position: absolute;
        top: 0; left: -100%; width: 60%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
        transition: left 0.5s ease;
        pointer-events: none;
    }
    button:not(:disabled):hover { background: var(--bg-surface-hover); border-color: var(--border-strong); }
    button:not(:disabled):hover::after { left: 140%; }
    button:not(:disabled):active { background: var(--bg-surface-active); transform: scale(0.97); }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    button:disabled { background: var(--bg-surface); color: var(--text-primary); border-color: var(--border-default); cursor: not-allowed; opacity: 0.45; svg { opacity: 0.4; } }
    button.btn-primary { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border-color: var(--border-accent); color: #fff; box-shadow: var(--shadow-accent); }
    button.btn-primary:not(:disabled):hover { background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%); transform: translateY(-1px); box-shadow: 0 6px 24px rgba(14,165,233,0.35); }
    button.btn-primary:not(:disabled):active { transform: translateY(0) scale(0.98); }

    /* AI Describe gets a special sky-shimmer treatment */
    #aiDescribe {
        background: linear-gradient(135deg, rgba(14,165,233,0.18) 0%, rgba(2,132,199,0.12) 100%);
        border-color: var(--border-accent);
        color: var(--accent-hover);
    }
    #aiDescribe:not(:disabled):hover {
        background: linear-gradient(135deg, rgba(14,165,233,0.28) 0%, rgba(2,132,199,0.20) 100%);
        box-shadow: var(--shadow-accent);
        transform: translateY(-1px);
    }
    #aiDescribe.running {
        background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
        border-color: var(--border-accent); color: #fff;
        animation: pulse-running 2s infinite;
    }
    #clearDescriptions {
        background: linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(220,38,38,0.08) 100%);
        border-color: rgba(239,68,68,0.35);
        color: #dc2626;
    }
    #clearDescriptions:not(:disabled):hover {
        background: linear-gradient(135deg, rgba(239,68,68,0.22) 0%, rgba(220,38,38,0.16) 100%);
        box-shadow: 0 4px 16px rgba(239,68,68,0.2);
        transform: translateY(-1px);
    }
    #clearDescriptions.running {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        border-color: rgba(239,68,68,0.5); color: #fff;
        animation: pulse-running 2s infinite;
    }

    legend, label { font-size: 12px; line-height: 16px; font-weight: 500; }

    /* ── Form Inputs ────────────────────────── */
    input[type="text"],
    input[type="input"],
    input[type="number"],
    input[type="password"],
    input[type="datetime-local"] {
        background: rgba(255, 255, 255, 0.55);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        color: var(--text-primary);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-sm);
        padding: 5px 10px; font-size: 12.5px; font-family: inherit; height: 30px;
        transition: border-color var(--duration-fast) var(--ease),
                    box-shadow var(--duration-fast) var(--ease),
                    background var(--duration-fast) var(--ease);
        width: 100%;
    }
    input[type="text"]:focus,
    input[type="input"]:focus,
    input[type="number"]:focus,
    input[type="password"]:focus,
    input[type="datetime-local"]:focus {
        outline: none;
        background: rgba(255, 255, 255, 0.80);
        border-color: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-glow);
    }
    input[type="text"]::placeholder,
    input[type="input"]::placeholder,
    input[type="number"]::placeholder,
    input[type="password"]::placeholder { color: var(--text-tertiary); }
    select {
        background: rgba(255, 255, 255, 0.55);
        color: var(--text-primary);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-sm); font-size: 12px; font-family: inherit;
        transition: border-color var(--duration-fast) var(--ease);
    }
    select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
    option.shared { background-color: rgba(14, 165, 233, 0.12); }
    option:checked { background-color: #0ea5e9; color: white; }

    /* ── Radio & Checkbox ──────────────────── */
    .radio-group { display: flex; flex-wrap: wrap; gap: 2px 12px; padding: 2px 0; }
    .radio-group label,
    .checkbox-control { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; padding: 3px 0; font-size: 12px; color: var(--text-secondary); transition: color var(--duration-fast) var(--ease); }
    .radio-group label:hover,
    .checkbox-control:hover { color: var(--text-primary); }
    input[type="radio"],
    input[type="checkbox"] { accent-color: var(--accent); }

    /* ============================================
       HEADER
       ============================================ */
    .header {
        padding: 10px 16px; display: flex; align-items: center; justify-content: space-between;
        background: linear-gradient(135deg, rgba(224, 242, 254, 0.95) 0%, rgba(186, 230, 253, 0.70) 100%);
        border-bottom: 1px solid var(--border-accent);
        gap: 12px; flex-shrink: 0;
        backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        .header-info { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .header-icon { color: var(--accent); display: flex; align-items: center; filter: drop-shadow(0 0 6px rgba(14,165,233,0.4)); }
        .header-text { font-size: 15px; font-weight: 700; letter-spacing: -0.02em; color: var(--text-primary); }
    }
    .header-steps { display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; color: var(--text-secondary); user-select: none; }
    .step-badge {
        display: inline-flex; align-items: center; justify-content: center;
        width: 20px; height: 20px; border-radius: 50%;
        background: #4ade80;
        color: #000; font-size: 11px; font-weight: 700; line-height: 1; flex-shrink: 0;
        box-shadow: 0 2px 8px rgba(74, 222, 128, 0.4);
    }
    .step-arrow { color: var(--text-tertiary); font-size: 14px; font-weight: 400; }
    #hide { cursor: pointer; fill: var(--text-tertiary); display: flex; align-items: center; padding: 4px; border-radius: var(--radius-sm); transition: all var(--duration-fast) var(--ease); }
    #hide:hover { fill: var(--text-primary); background-color: var(--bg-surface-hover); }

    /* ============================================
       PANEL SECTIONS
       ============================================ */
    .panel-section { padding: 0; flex-shrink: 0; }
    .panel-section + .panel-section { border-top: 1px solid var(--border-subtle); padding-top: 2px; }
    .section-label { position: relative; display: flex; align-items: center; gap: 8px; padding: 10px 4px 8px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-secondary); user-select: none; }
    .settings-note { margin: 6px 0 12px; color: var(--text-secondary); font-size: 11.5px; line-height: 1.45; }
    .help-tooltip { position: static; cursor: pointer; color: var(--text-tertiary); font-size: 11px; margin-left: -2px; transition: color var(--duration-fast) var(--ease); font-weight: 400; outline: none; }
    .help-tooltip:hover, .help-tooltip:focus { color: var(--accent); }
    .help-tooltip::after { content: attr(data-help); position: absolute; top: calc(100% - 6px); left: 4px; right: 4px; transform: translateY(-5px); background: rgba(255, 255, 255, 0.98); color: var(--text-primary); padding: 10px 14px; border-radius: var(--radius-md); box-shadow: var(--shadow-panel); border: 1px solid var(--border-subtle); font-size: 12px; font-weight: 500; line-height: 1.4; white-space: normal; z-index: 1000; opacity: 0; visibility: hidden; transition: opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease; pointer-events: none; text-align: left; text-transform: none; letter-spacing: normal; }
    .help-tooltip:focus::after { opacity: 1; visibility: visible; transform: translateY(0); }
    .gptk-toolbar-tooltip {
        position: fixed;
        z-index: 2147483647;
        pointer-events: none;
        padding: 6px 10px;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.94);
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
        box-shadow: 0 10px 30px rgba(2, 8, 23, 0.32);
        opacity: 0;
        transform: translate(-50%, -6px);
        transition: opacity 120ms ease, transform 120ms ease;
    }
    .gptk-toolbar-tooltip.is-visible {
        opacity: 1;
        transform: translate(-50%, 0);
    }

    /* ============================================
       SOURCE TABS
       ============================================ */
    .sources { gap: 3px; display: flex; flex-wrap: wrap; padding: 4px 0 8px; user-select: none;
        .sourceHeader {
            display: inline-flex; align-items: center; gap: 5px;
            fill: var(--text-tertiary); color: var(--text-secondary); cursor: pointer;
            font-weight: 600; font-size: 11.5px; letter-spacing: 0.03em; text-transform: uppercase;
            transition: all var(--duration) var(--ease);
            border-radius: var(--radius-md); padding: 6px 10px;
            svg { transition: fill var(--duration-fast) var(--ease); }
            span { line-height: 1; }
        }
        .source input { display: none; }
        input:disabled + .sourceHeader { cursor: not-allowed; color: var(--text-disabled); fill: var(--text-disabled); opacity: 0.4; }
        input:not(:disabled) + .sourceHeader:hover { fill: var(--text-primary); color: var(--text-primary); background-color: var(--bg-surface); }
        .source input:checked + .sourceHeader {
            background: linear-gradient(135deg, #0ea5e9, #0284c7);
            fill: #fff; color: #fff;
            box-shadow: 0 2px 12px rgba(14,165,233,0.4), inset 0 1px 0 rgba(255,255,255,0.12);
            animation: gptk-pill-glow 0.5s ease-out;
        }
    }

    /* ============================================
       ACTION BAR
       ============================================ */
    .action-bar {
        display: flex; flex-direction: column;
        background: rgba(255, 255, 255, 0.60);
        backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        user-select: none; border-bottom: 1px solid var(--border-subtle); min-height: 0; padding-top: 4px;
        .section-label { padding: 6px 12px 4px; }
        .action-categories { display: flex; flex-direction: column; gap: 12px; padding: 4px 12px 12px; }
        .action-group { display: flex; flex-direction: column; gap: 6px; }
        .action-group-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); margin: 0; padding-left: 2px; }
        .action-buttons-grid { display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-start; }
        .to-existing-container,
        .to-new-container { display: none; flex-wrap: wrap; gap: 6px; padding: 8px 12px; align-items: center; }
        .album-form { display: flex; gap: 6px; align-items: center; flex: 1; min-width: 0; }
        .album-form select { flex: 1; min-width: 120px; max-width: 400px; height: 30px; }
        .album-form input[type="text"] { flex: 1; min-width: 120px; max-width: 300px; }
        button.running { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border-color: var(--border-accent); color: #fff; animation: pulse-running 2s infinite; }
        svg { fill: currentColor; }
    }
    .refresh-albums { cursor: pointer; fill: var(--text-secondary); background: var(--bg-surface); border-radius: var(--radius-sm); padding: 3px; border: 1px solid var(--border-default); transition: all var(--duration-fast) var(--ease); display: flex; justify-content: center; align-items: center; z-index: 10; position: relative; }
    .refresh-albums * { pointer-events: none; }
    .refresh-albums.spinning svg { animation: gptk-spin 0.8s linear infinite; }
    .refresh-albums:hover { fill: var(--accent-hover); background: var(--bg-surface-hover); border-color: var(--border-accent); }
    .svg-container { display: flex; justify-content: center; }

    /* ============================================
       WINDOW BODY
       ============================================ */
    .window-body { flex: 1 1 0; min-height: 0; overflow: hidden; }

    /* ============================================
       SIDEBAR
       ============================================ */
    .sidebar {
        height: 100%; position: relative; display: flex; flex-direction: column;
        background: rgba(255, 255, 255, 0.55);
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        overflow-y: auto; overflow-x: hidden; max-height: 100%; padding: 0 10px 10px 10px;
        border-right: 1px solid var(--border-subtle);
        form { width: 100%; }
        .filters-form { flex: 1 1 auto; }
        .settings-form { margin-bottom: 4px; flex-shrink: 0; summary { color: var(--text-tertiary); font-size: 12px; } }
        summary { font-size: 12.5px; font-weight: 600; line-height: 20px; position: relative; overflow: hidden; margin-bottom: 2px; padding: 7px 8px; cursor: pointer; white-space: nowrap; text-overflow: ellipsis; border-radius: var(--radius-sm); flex-shrink: 0; transition: all var(--duration-fast) var(--ease); color: var(--text-secondary); }
        summary:hover { background: var(--bg-surface); color: var(--text-primary); }
        summary::marker { color: var(--text-tertiary); }
        details[open] > summary { color: var(--text-primary); }
        details[open] > summary::marker { color: var(--accent); }
        details.filter-active > summary { color: var(--accent); background-color: var(--accent-muted); }
        details.filter-active > summary::marker { color: var(--accent); }
        fieldset.filter-active > label { color: var(--accent); }
        fieldset { flex-direction: column; margin: 0 4px 0 16px; padding: 0; border: 0; font-weight: inherit; font-style: inherit; font-family: inherit; font-size: 100%; vertical-align: baseline; }
        legend, label { display: block; width: 100%; margin-bottom: 4px; }
        legend { margin-bottom: 3px; color: var(--text-tertiary); text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.05em; }
        select { width: 100%; }
        .select-control-buttons-row { display: flex; flex-wrap: wrap; height: auto; gap: 3px; margin-top: 4px; }
        .input-wrapper { margin-left: 0; margin-bottom: 8px; }
        .sidebar-top { display: flex; align-items: center; gap: 5px; padding: 8px 0 4px 0; }
        #filterResetButton { width: 100%; fill: var(--text-tertiary); color: var(--text-tertiary); cursor: pointer; border-radius: var(--radius-sm); padding: 5px 8px; transition: all var(--duration-fast) var(--ease); gap: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
        #filterResetButton:hover { fill: var(--accent-hover); color: var(--accent-hover); background: var(--accent-muted); }
        .form-control { cursor: pointer; }
        .warning-badge { display: inline-block; color: var(--warning-text); background-color: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.2); border-radius: var(--radius-xs); padding: 2px 8px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
        .filter-note { display: block; font-size: 11px; color: var(--text-tertiary); line-height: 1.4; margin-top: 2px; }
        .warning { color: var(--danger); }
        .date-reset { cursor: pointer; fill: var(--text-tertiary); stroke-width: 0; stroke-linejoin: round; stroke-linecap: round; height: 28px; width: 28px; stroke: var(--bg-base); transition: stroke-width 1s cubic-bezier(0, 2.5, 0.30, 2.5), fill var(--duration-fast) var(--ease); margin-left: 4px; border-radius: var(--radius-xs); }
        .date-reset.clicked { stroke-width: 2; }
        .date-reset:hover { fill: var(--accent-hover); }
        .dateForm { grid-template-columns: 3em 60% 1em; }
        .settings-controls { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px 0; }
    }

    /* ============================================
       MAIN PANEL
       ============================================ */
    .main {
        height: 100%; overflow: auto; display: grid; grid-auto-flow: row; grid-template-rows: auto auto auto 1fr; max-width: 100%;
        background: var(--bg-base);
        .filter-preview {
            background: var(--bg-overlay);
            padding: 6px 14px; display: flex; align-items: center; gap: 8px;
            border-bottom: 1px solid var(--border-subtle);
            svg { flex-shrink: 0; opacity: 0.4; }
            span { text-wrap: pretty; font-size: 12px; color: var(--text-secondary); letter-spacing: 0.01em; }
        }
        #logArea {
            height: 100%;
            font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 12px; line-height: 1.6; overflow: auto; padding: 12px 16px;
            user-select: text; cursor: auto; color: var(--text-secondary);
            div { padding: 1px 0; animation: gptk-fadeUp 0.3s ease-out both; }
            .error { color: var(--danger); }
            .success { color: var(--success); }
        }
        .button-container {
            background: var(--bg-raised); display: flex; gap: 6px; padding: 6px 12px;
            border-bottom: 1px solid var(--border-subtle);
            #stopProcess { 
                display: none; 
                background: var(--danger); 
                border: 1.5px solid transparent; 
                color: #fff; 
                font-weight: 600;
                border-radius: var(--radius-md);
                transition: all var(--duration-fast) var(--ease);
            }
            #stopProcess:hover { background: var(--danger-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2); }
            #stopProcess:active { transform: translateY(0); }
        }
    }

    /* ============================================
       FOOTER
       ============================================ */
    .footer {
        width: 100%; padding: 6px 14px; height: 34px;
        background: linear-gradient(90deg, var(--glass-sidebar) 0%, rgba(14,165,233,0.04) 100%);
        border-top: 1px solid var(--border-subtle);
        display: flex; align-items: center; justify-content: space-between;
        .auto-scroll-container {
            label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; margin: 0;
                span { font-size: 10.5px; color: var(--text-tertiary); font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
            }
        }
        .info-container,
        .info-container a { font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace; color: var(--text-tertiary); font-size: 10.5px; text-decoration: none; transition: color var(--duration-fast) var(--ease); }
        .info-container a:hover { color: var(--accent-hover); }
    }

    /* ============================================
       SCROLLBAR — matches tst-scrollbar style
       ============================================ */
    .scroll::-webkit-scrollbar { width: 5px; height: 5px; }
    .scroll::-webkit-scrollbar-corner { background-color: transparent; }
    .scroll::-webkit-scrollbar-track { background: rgba(14,165,233,0.04); border-radius: 10px; }
    .scroll::-webkit-scrollbar-thumb { background: rgba(14,165,233,0.15); border-radius: 10px; min-height: 30px; }
    .scroll::-webkit-scrollbar-thumb:hover { background: rgba(14,165,233,0.30); }
    .scroll::-webkit-scrollbar-thumb,
    .scroll::-webkit-scrollbar-track { visibility: hidden; }
    .scroll:hover::-webkit-scrollbar-thumb,
    .scroll:hover::-webkit-scrollbar-track { visibility: visible; }
}

/* ♿ Respect reduced motion — extended to match Social Toolkit reference */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
    #gptk button::after { display: none; }
    #gptk button:not(:disabled):hover { transform: none; box-shadow: none; }
    #gptk button.btn-primary:not(:disabled):hover { transform: none; }
    #gptk .gptk-confirm-box { animation: none; }
    #gptk .source input:checked + .sourceHeader { animation: none; }
}
`);

    // ── helpers ────────────────────────────────────────────────────────────

    function parseSize(value) {
        return parseInt(value ?? '0', 10);
    }
    function formatDate(value) {
        return value ? new Date(value).toLocaleString('en-GB') : null;
    }
    function pluralAlbums(keys, noun) {
        return Array.isArray(keys)
            ? `in the ${keys.length} ${noun} albums`
            : `in the ${noun} album`;
    }
    // ── rules ──────────────────────────────────────────────────────────────
    const rules = [
        // ownership
        { test: (f) => f.owned === 'true', describe: () => 'owned' },
        { test: (f) => f.owned === 'false', describe: () => 'not owned' },
        // space
        { test: (f) => f.space === 'consuming', describe: () => 'space consuming' },
        { test: (f) => f.space === 'non-consuming', describe: () => 'non-space consuming' },
        // upload status
        { test: (f) => f.uploadStatus === 'full', describe: () => 'fully uploaded' },
        { test: (f) => f.uploadStatus === 'partial', describe: () => 'partially uploaded' },
        // shared
        { test: (f) => f.excludeShared === 'true', describe: () => 'non-shared' },
        // favorites
        { test: (f) => f.favorite === 'true', describe: () => 'favorite' },
        {
            test: (f) => f.excludeFavorites === 'true' || f.favorite === 'false',
            describe: () => 'non-favorite',
        },
        // quality
        { test: (f) => f.quality === 'original', describe: () => 'original quality' },
        { test: (f) => f.quality === 'storage-saver', describe: () => 'storage-saver quality' },
        // location
        { test: (f) => f.hasLocation === 'true', describe: () => 'with location' },
        { test: (f) => f.hasLocation === 'false', describe: () => 'without location' },
        // bounding box
        {
            test: (f) => Boolean(f.boundSouth && f.boundWest && f.boundNorth && f.boundEast),
            describe: (f) => `within area S${f.boundSouth} W${f.boundWest} N${f.boundNorth} E${f.boundEast}`,
        },
        // archive
        { test: (f) => f.archived === 'true', describe: () => 'archived' },
        { test: (f) => f.archived === 'false', describe: () => 'non-archived' },
        // media type (always produces a token)
        {
            test: () => true,
            describe: (f) => {
                const typeMap = {
                    video: 'videos',
                    live: 'live photos',
                    image: 'images',
                };
                return typeMap[f.type ?? ''] ?? 'media';
            },
        },
        // search query
        {
            test: (f) => !!f.searchQuery,
            describe: (f) => `in search results of query "${f.searchQuery}"`,
        },
        // filename regex
        {
            test: (f) => !!f.fileNameRegex,
            describe: (f) => {
                const verb = f.fileNameMatchType === 'exclude' ? 'not matching' : 'matching';
                return `with filename ${verb} regex "${f.fileNameRegex}"`;
            },
        },
        // description regex
        {
            test: (f) => !!f.descriptionRegex,
            describe: (f) => {
                const verb = f.descriptionMatchType === 'exclude' ? 'not matching' : 'matching';
                return `with description ${verb} regex "${f.descriptionRegex}"`;
            },
        },
        // description status
        { test: (f) => f.descriptionStatus === 'has', describe: () => 'with descriptions' },
        { test: (f) => f.descriptionStatus === 'missing', describe: () => 'missing descriptions' },
        // album-only dedupe
        { test: (f) => f.albumOnlyDedupe === 'true', describe: () => 'using album-only dedupe' },
        // similarity
        {
            test: (f) => !!f.similarityThreshold,
            describe: (f) => `with similarity more than "${f.similarityThreshold}"`,
        },
        // resolution
        {
            test: (f) => parseSize(f.minWidth) > 0 || parseSize(f.maxWidth) > 0 || parseSize(f.minHeight) > 0 || parseSize(f.maxHeight) > 0,
            describe: (f) => {
                const parts = [];
                const minW = parseSize(f.minWidth);
                const maxW = parseSize(f.maxWidth);
                const minH = parseSize(f.minHeight);
                const maxH = parseSize(f.maxHeight);
                if (minW > 0)
                    parts.push(`width >= ${minW}px`);
                if (maxW > 0)
                    parts.push(`width <= ${maxW}px`);
                if (minH > 0)
                    parts.push(`height >= ${minH}px`);
                if (maxH > 0)
                    parts.push(`height <= ${maxH}px`);
                return `with resolution ${parts.join(', ')}`;
            },
        },
        // size range
        {
            test: (f) => parseSize(f.lowerBoundarySize) > 0 || parseSize(f.higherBoundarySize) > 0,
            describe: (f) => {
                const lo = parseSize(f.lowerBoundarySize);
                const hi = parseSize(f.higherBoundarySize);
                const parts = [];
                if (lo > 0)
                    parts.push(`larger than ${lo} bytes`);
                if (lo > 0 && hi > 0)
                    parts.push('and');
                if (hi > 0)
                    parts.push(`smaller than ${hi} bytes`);
                return parts;
            },
        },
        // albums include
        {
            test: (f) => !!f.albumsInclude,
            describe: (f) => pluralAlbums(f.albumsInclude ?? [], 'target'),
        },
        // albums exclude
        {
            test: (f) => !!f.albumsExclude,
            describe: (f) => ['excluding items', pluralAlbums(f.albumsExclude ?? [], 'selected')],
        },
        // date range
        {
            test: (f) => Boolean(f.lowerBoundaryDate ?? f.higherBoundaryDate),
            describe: (f) => {
                const lo = formatDate(f.lowerBoundaryDate);
                const hi = formatDate(f.higherBoundaryDate);
                const parts = [];
                if (f.dateType === 'taken')
                    parts.push('taken');
                else if (f.dateType === 'uploaded')
                    parts.push('uploaded');
                if (lo && hi) {
                    parts.push(f.intervalType === 'exclude'
                        ? `before ${lo} and after ${hi}`
                        : `from ${lo} to ${hi}`);
                }
                else if (lo) {
                    parts.push(f.intervalType === 'exclude' ? `before ${lo}` : `after ${lo}`);
                }
                else if (hi) {
                    parts.push(f.intervalType === 'exclude' ? `after ${hi}` : `before ${hi}`);
                }
                return parts;
            },
        },
        // sort
        { test: (f) => !!f.sortBySize, describe: () => 'sorted by size' },
    ];
    // ── validation ─────────────────────────────────────────────────────────
    function validate(filter) {
        if (filter.lowerBoundaryDate &&
            filter.higherBoundaryDate &&
            filter.lowerBoundaryDate >= filter.higherBoundaryDate) {
            return 'Error: Invalid Date Interval';
        }
        const lo = parseSize(filter.lowerBoundarySize);
        const hi = parseSize(filter.higherBoundarySize);
        if (lo > 0 && hi > 0 && lo >= hi) {
            return 'Error: Invalid Size Filter';
        }
        const bS = parseFloat(filter.boundSouth ?? '');
        const bN = parseFloat(filter.boundNorth ?? '');
        const hasSomeBounds = [bS, parseFloat(filter.boundWest ?? ''), bN, parseFloat(filter.boundEast ?? '')].some((v) => !isNaN(v));
        const hasAllBounds = [bS, parseFloat(filter.boundWest ?? ''), bN, parseFloat(filter.boundEast ?? '')].every((v) => !isNaN(v));
        if (hasSomeBounds && !hasAllBounds) {
            return 'Error: Bounding Box requires all four coordinates';
        }
        if (hasAllBounds && bS >= bN) {
            return 'Error: South latitude must be less than North latitude';
        }
        const minW = parseSize(filter.minWidth);
        const maxW = parseSize(filter.maxWidth);
        if (minW > 0 && maxW > 0 && minW >= maxW) {
            return 'Error: Invalid Resolution Filter (Width)';
        }
        const minH = parseSize(filter.minHeight);
        const maxH = parseSize(filter.maxHeight);
        if (minH > 0 && maxH > 0 && minH >= maxH) {
            return 'Error: Invalid Resolution Filter (Height)';
        }
        return null;
    }
    // ── main ───────────────────────────────────────────────────────────────
    function generateFilterDescription(filter) {
        const error = validate(filter);
        if (error)
            return error;
        const parts = ['Filter: All'];
        for (const rule of rules) {
            if (rule.test(filter)) {
                const fragment = rule.describe(filter);
                if (Array.isArray(fragment)) {
                    parts.push(...fragment);
                }
                else {
                    parts.push(fragment);
                }
            }
        }
        const result = parts.join(' ');
        return result === 'Filter: All media' ? 'Filter: None' : result;
    }
    function getSelectedAlbumNames(albumValues) {
        const values = Array.isArray(albumValues)
            ? albumValues
            : albumValues
                ? [albumValues]
                : [];
        if (values.length === 0) {
            return [];
        }
        const names = [];
        const seen = new Set();
        const appendName = (name) => {
            const normalized = typeof name === 'string' ? name.trim() : '';
            if (!normalized || seen.has(normalized)) {
                return;
            }
            seen.add(normalized);
            names.push(normalized);
        };
        const optionSelectors = [
            'select[name="albumsInclude"] option',
            'select[name="albumsExclude"] option',
            'select[name="targetAlbumMediaKeyExisting"] option',
        ];
        for (const selector of optionSelectors) {
            document.querySelectorAll(selector).forEach((option) => {
                if (!(option instanceof HTMLOptionElement) || !values.includes(option.value)) {
                    return;
                }
                appendName(option.textContent);
            });
        }
        if (names.length === values.length) {
            return names;
        }
        const cachedAlbums = getFromStorage('albums');
        if (Array.isArray(cachedAlbums)) {
            cachedAlbums.forEach((album) => {
                if (values.includes(album?.mediaKey)) {
                    appendName(album?.title);
                }
            });
        }
        return names;
    }
    function getCurrentAlbumMediaKeyFromLocation() {
        const match = window.location.pathname.match(/\/(?:album|share)\/([^/?#]+)/);
        return match?.[1] ? decodeURIComponent(match[1]) : null;
    }
    function selectSource(sourceId) {
        const sourceInput = document.getElementById(sourceId);
        if (sourceInput instanceof HTMLInputElement && !sourceInput.disabled) {
            sourceInput.checked = true;
        }
    }
    function selectOnlyAlbumOption(albumMediaKey) {
        const includeSelect = document.querySelector('select[name="albumsInclude"]');
        if (!(includeSelect instanceof HTMLSelectElement) || !albumMediaKey) {
            return false;
        }
        let found = false;
        for (const option of includeSelect.options) {
            const selected = option.value === albumMediaKey;
            option.selected = selected;
            found ||= selected;
        }
        if (found) {
            includeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return found;
    }
    function autoSelectCurrentAlbum(options = {}) {
        const albumMediaKey = getCurrentAlbumMediaKeyFromLocation();
        if (!albumMediaKey || !selectOnlyAlbumOption(albumMediaKey)) {
            return false;
        }
        if (options.switchSource !== false) {
            selectSource('albums');
        }
        return true;
    }

    function getFormData(selector, options = {}) {
        const form = {};
        const formElement = document.querySelector(selector);
        if (!formElement)
            return form;
        const includeEmpty = options.includeEmpty === true;
        const formData = new FormData(formElement);
        for (const [key, value] of formData) {
            const strValue = String(value);
            if (strValue || includeEmpty) {
                // Check if the key already exists in the form object
                if (Reflect.has(form, key)) {
                    // If the value is not an array, make it an array
                    if (!Array.isArray(form[key])) {
                        form[key] = [form[key]];
                    }
                    // Add the new value to the array
                    (form[key]).push(strValue);
                }
                else {
                    // If the key doesn't exist in the form object, add it
                    form[key] = strValue;
                }
            }
        }
        return form;
    }

    function disableActionBar(disabled) {
        const actions = document.querySelectorAll('.action-bar button, .action-bar input, .action-bar select');
        for (const action of actions) {
            action.disabled = disabled;
        }
    }

    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
    // The parser transforms raw untyped JSON arrays from Google's undocumented
    // batchexecute API into typed objects.  Every access into the response is
    // inherently `any`-typed, so the no-unsafe-* rules are expected here.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    /*
      Notes:
      Add =w417-h174-k-no?authuser=0 to thumbnail URL to set custom size,
      remove 'video' watermark, remove auth requirement.
    */
    function libraryItemParse(itemData) {
        return {
            mediaKey: itemData?.[0],
            timestamp: itemData?.[2],
            timezoneOffset: itemData?.[4],
            creationTimestamp: itemData?.[5],
            dedupKey: itemData?.[3],
            thumb: itemData?.[1]?.[0],
            resWidth: itemData?.[1]?.[1],
            resHeight: itemData?.[1]?.[2],
            isPartialUpload: itemData[12]?.[0] === 20,
            isArchived: itemData?.[13],
            isFavorite: itemData?.at(-1)?.[163238866]?.[0],
            duration: itemData?.at(-1)?.[76647426]?.[0],
            descriptionShort: itemData?.at(-1)?.[396644657]?.[0],
            isLivePhoto: itemData?.at(-1)?.[146008172] ? true : false,
            livePhotoDuration: itemData?.at(-1)?.[146008172]?.[1],
            isOwned: itemData[7]?.filter((subArray) => subArray.includes(27)).length === 0,
            geoLocation: {
                coordinates: itemData?.at(-1)?.[129168200]?.[1]?.[0],
                name: itemData?.at(-1)?.[129168200]?.[1]?.[4]?.[0]?.[1]?.[0]?.[0],
            },
        };
    }
    function libraryTimelinePage(data) {
        return {
            items: data?.[0]?.map((itemData) => libraryItemParse(itemData)),
            nextPageId: data?.[1],
            lastItemTimestamp: parseInt(data?.[2]),
        };
    }
    function libraryGenericPage(data) {
        return {
            items: data?.[0]?.map((itemData) => libraryItemParse(itemData)),
            nextPageId: data?.[1],
        };
    }
    function lockedFolderItemParse(itemData) {
        return {
            mediaKey: itemData?.[0],
            timestamp: itemData?.[2],
            creationTimestamp: itemData?.[5],
            dedupKey: itemData?.[3],
            duration: itemData?.at(-1)?.[76647426]?.[0],
        };
    }
    function lockedFolderPage(data) {
        return {
            nextPageId: data?.[0],
            items: data?.[1]?.map((itemData) => lockedFolderItemParse(itemData)),
        };
    }
    function linkParse(itemData) {
        return {
            mediaKey: itemData?.[6],
            linkId: itemData?.[17],
            itemCount: itemData?.[3],
        };
    }
    function linksPage(data) {
        return {
            items: data?.[0]?.map((itemData) => linkParse(itemData)),
            nextPageId: data?.[1],
        };
    }
    function albumParse(itemData) {
        return {
            mediaKey: itemData?.[0],
            ownerActorId: itemData?.[6]?.[0],
            title: itemData?.at(-1)?.[72930366]?.[1],
            thumb: itemData?.[1]?.[0],
            itemCount: itemData?.at(-1)?.[72930366]?.[3],
            creationTimestamp: itemData?.at(-1)?.[72930366]?.[2]?.[4],
            modifiedTimestamp: itemData?.at(-1)?.[72930366]?.[2]?.[9],
            timestampRange: [itemData?.at(-1)?.[72930366]?.[2]?.[5], itemData?.at(-1)?.[72930366]?.[2]?.[6]],
            isShared: itemData?.at(-1)?.[72930366]?.[4] || false,
        };
    }
    function albumsPage(data) {
        return {
            items: data?.[0]?.map((itemData) => albumParse(itemData)),
            nextPageId: data?.[1],
        };
    }
    function partnerSharedItemParse(itemData) {
        return {
            mediaKey: itemData?.[0],
            thumb: itemData?.[1]?.[0],
            resWidth: itemData[1]?.[1],
            resHeight: itemData[1]?.[2],
            timestamp: itemData?.[2],
            timezoneOffset: itemData?.[4],
            creationTimestamp: itemData?.[5],
            dedupKey: itemData?.[3],
            saved: itemData?.[7]?.[3]?.[0] !== 20,
            isLivePhoto: itemData?.at(-1)?.[146008172] ? true : false,
            livePhotoDuration: itemData?.at(-1)?.[146008172]?.[1],
            duration: itemData?.at(-1)?.[76647426]?.[0],
        };
    }
    function albumItemParse(itemData) {
        return {
            mediaKey: itemData?.[0],
            thumb: itemData?.[1]?.[0],
            resWidth: itemData[1]?.[1],
            resHeight: itemData[1]?.[2],
            timestamp: itemData?.[2],
            timezoneOffset: itemData?.[4],
            creationTimestamp: itemData?.[5],
            dedupKey: itemData?.[3],
            isLivePhoto: itemData?.at(-1)?.[146008172] ? true : false,
            livePhotoDuration: itemData?.at(-1)?.[146008172]?.[1],
            duration: itemData?.at(-1)?.[76647426]?.[0],
        };
    }
    function actorParse(data) {
        return {
            actorId: data?.[0],
            gaiaId: data?.[1],
            name: data?.[11]?.[0],
            gender: data?.[11]?.[2],
            profilePhotoUrl: data?.[12]?.[0], // Fixed typo: was "profiePhotoUrl"
        };
    }
    function partnerSharedItemsPage(data) {
        return {
            nextPageId: data?.[0],
            items: data?.[1]?.map((itemData) => partnerSharedItemParse(itemData)),
            members: data?.[2]?.map((itemData) => actorParse(itemData)),
            partnerActorId: data?.[4], // Fixed typo: was "parnterActorId"
            gaiaId: data?.[5],
        };
    }
    function albumItemsPage(data) {
        return {
            items: data?.[1]?.map((itemData) => albumItemParse(itemData)),
            nextPageId: data?.[2],
            mediaKey: data?.[3]?.[0],
            title: data?.[3]?.[1],
            owner: actorParse(data?.[3]?.[5]),
            startTimestamp: data?.[3]?.[2]?.[5],
            endTimestamp: data?.[3]?.[2]?.[6],
            lastActivityTimestamp: data?.[3]?.[2]?.[7],
            creationTimestamp: data?.[3]?.[2]?.[8],
            newestOperationTimestamp: data?.[3]?.[2]?.[9],
            itemCount: data?.[3]?.[21],
            authKey: data?.[3]?.[19],
            members: data?.[3]?.[9]?.map((itemData) => actorParse(itemData)),
        };
    }
    function itemBulkMediaInfoParse(itemData) {
        return {
            mediaKey: itemData?.[0],
            descriptionFull: itemData?.[1]?.[2],
            fileName: itemData?.[1]?.[3],
            timestamp: itemData?.[1]?.[6],
            timezoneOffset: itemData?.[1]?.[7],
            creationTimestamp: itemData?.[1]?.[8],
            size: itemData?.[1]?.[9],
            takesUpSpace: itemData?.[1]?.at(-1)?.[0] === undefined ? null : itemData?.[1]?.at(-1)?.[0] === 1,
            spaceTaken: itemData?.[1]?.at(-1)?.[1],
            isOriginalQuality: itemData?.[1]?.at(-1)?.[2] === undefined ? null : itemData?.[1]?.at(-1)?.[2] === 2,
        };
    }
    function itemInfoExtParse(itemData) {
        const source = [null, null];
        const sourceMap = {
            1: 'mobile',
            2: 'web',
            3: 'shared',
            4: 'partnerShared',
            7: 'drive',
            8: 'pc',
            11: 'gmail',
        };
        source[0] = itemData[0]?.[27]?.[0] ? sourceMap[itemData[0][27][0]] ?? null : null;
        const sourceMapSecondary = {
            1: 'android',
            3: 'ios',
        };
        source[1] = itemData[0]?.[27]?.[1]?.[2] ? sourceMapSecondary[itemData[0][27][1][2]] ?? null : null;
        let owner = null;
        if (itemData[0]?.[27]?.length > 0) {
            owner = actorParse(itemData[0]?.[27]?.[3]?.[0] || itemData[0]?.[27]?.[4]?.[0]);
        }
        if (!owner?.actorId) {
            owner = actorParse(itemData[0]?.[28]);
        }
        return {
            mediaKey: itemData[0]?.[0],
            dedupKey: itemData[0]?.[11],
            descriptionFull: itemData[0]?.[1],
            fileName: itemData[0]?.[2],
            timestamp: itemData[0]?.[3],
            timezoneOffset: itemData[0]?.[4],
            size: itemData[0]?.[5],
            resWidth: itemData[0]?.[6],
            resHeight: itemData[0]?.[7],
            cameraInfo: itemData[0]?.[23],
            albums: itemData[0]?.[19]?.map((album) => albumParse(album)),
            source,
            takesUpSpace: itemData[0]?.[30]?.[0] === undefined ? null : itemData[0]?.[30]?.[0] === 1,
            spaceTaken: itemData[0]?.[30]?.[1],
            isOriginalQuality: itemData[0]?.[30]?.[2] === undefined ? null : itemData[0][30][2] === 2,
            savedToYourPhotos: itemData[0]?.[12].filter((subArray) => subArray.includes(20)).length === 0,
            owner,
            geoLocation: {
                coordinates: itemData[0]?.[9]?.[0] || itemData[0]?.[13]?.[0],
                name: itemData[0]?.[13]?.[2]?.[0]?.[1]?.[0]?.[0],
                mapThumb: itemData?.[1],
            },
            other: itemData[0]?.[31],
        };
    }
    function itemInfoParse(itemData) {
        return {
            mediaKey: itemData[0]?.[0],
            dedupKey: itemData[0]?.[3],
            resWidth: itemData[0]?.[1]?.[1],
            resHeight: itemData[0]?.[1]?.[2],
            isPartialUpload: itemData[0]?.[12]?.[0] === 20,
            timestamp: itemData[0]?.[2],
            timezoneOffset: itemData[0]?.[4],
            creationTimestamp: itemData[0]?.[5],
            downloadUrl: itemData?.[1],
            downloadOriginalUrl: itemData?.[7],
            savedToYourPhotos: itemData[0]?.[15]?.[163238866]?.length > 0,
            isArchived: itemData[0]?.[13],
            takesUpSpace: itemData[0]?.[15]?.[318563170]?.[0]?.[0] === undefined ? null : itemData[0]?.[15]?.[318563170]?.[0]?.[0] === 1,
            spaceTaken: itemData[0]?.[15]?.[318563170]?.[0]?.[1],
            isOriginalQuality: itemData[0]?.[15]?.[318563170]?.[0]?.[2] === undefined ? null : itemData[0]?.[15]?.[318563170]?.[0]?.[2] === 2,
            isFavorite: itemData[0]?.[15]?.[163238866]?.[0],
            duration: itemData[0]?.[15]?.[76647426]?.[0],
            isLivePhoto: itemData[0]?.[15]?.[146008172] ? true : false,
            livePhotoDuration: itemData[0]?.[15]?.[146008172]?.[1],
            livePhotoVideoDownloadUrl: itemData[0]?.[15]?.[146008172]?.[3],
            descriptionFull: itemData[10],
            thumb: itemData[12],
        };
    }
    function bulkMediaInfo(data) {
        return data.map((itemData) => itemBulkMediaInfoParse(itemData));
    }
    function downloadTokenCheckParse(data) {
        return {
            fileName: data?.[0]?.[0]?.[0]?.[2]?.[0]?.[0],
            downloadUrl: data?.[0]?.[0]?.[0]?.[2]?.[0]?.[1],
            downloadSize: data?.[0]?.[0]?.[0]?.[2]?.[0]?.[2],
            unzippedSize: data?.[0]?.[0]?.[0]?.[2]?.[0]?.[3],
        };
    }
    function storageQuotaParse(data) {
        return {
            totalUsed: data?.[6]?.[0],
            totalAvailable: data?.[6]?.[1],
            usedByGPhotos: data?.[6]?.[3],
        };
    }
    function remoteMatchParse(itemData) {
        return {
            hash: itemData?.[0],
            mediaKey: itemData?.[1]?.[0],
            thumb: itemData?.[1]?.[1]?.[0],
            resWidth: itemData?.[1]?.[1]?.[1],
            resHeight: itemData?.[1]?.[1]?.[2],
            timestamp: itemData?.[1]?.[2],
            dedupKey: itemData?.[1]?.[3],
            timezoneOffset: itemData?.[1]?.[4],
            creationTimestamp: itemData?.[1]?.[5],
            duration: itemData?.[1]?.at(-1)?.[76647426]?.[0],
            cameraInfo: itemData?.[1]?.[1]?.[8],
        };
    }
    function remoteMatchesParse(data) {
        return data?.[0]?.map((itemData) => remoteMatchParse(itemData)) ?? [];
    }
    const parserRegistry = {
        'lcxiM': libraryTimelinePage,
        'nMFwOc': lockedFolderPage,
        'EzkLib': libraryGenericPage,
        'F2A0H': linksPage,
        'Z5xsfc': albumsPage,
        'snAcKc': albumItemsPage,
        'e9T5je': partnerSharedItemsPage,
        'VrseUb': itemInfoParse,
        'fDcn4b': itemInfoExtParse,
        'EWgK9e': bulkMediaInfo,
        'dnv2s': downloadTokenCheckParse,
        'EzwWhf': storageQuotaParse,
        'swbisb': remoteMatchesParse,
    };
    function parser(data, rpcid) {
        if (!data?.length)
            return null;
        const parserFn = parserRegistry[rpcid];
        if (parserFn)
            return parserFn(data);
        return null;
    }

    // Lazy getter: reads WIZ_global_data only when first accessed, not at parse time.
    // This prevents a TypeError crash if the script fires before Google Photos has
    // finished setting up WIZ_global_data — which would silently kill the entire script.
    const windowGlobalData = new Proxy({}, {
        get(_, key) {
            const wiz = unsafeWindow.WIZ_global_data || {};
            const map = {
                rapt:    wiz.Dbw5Ud,
                account: wiz.oPEP7c,
                'f.sid': wiz.FdrFJe,
                bl:      wiz.cfb2h,
                path:    wiz.eptZe,
                at:      wiz.SNlM0e,
            };
            return map[key];
        }
    });

    /**
     * Low-level client for Google Photos' undocumented `batchexecute` RPC API.
     *
     * Every method wraps a single RPC call, handles retry with exponential
     * backoff, and (optionally) parses the raw response into a typed object.
     *
     * Exposed globally as `gptkApi` for console scripting:
     * ```js
     * const info = await gptkApi.getItemInfoExt('MEDIA_KEY');
     * ```
     */
    class Api {
        /**
         * Helper to perform a low-level WIZ API request with optional parsing and error handling.
         * Consolidates duplicate boilerplate from individual API methods.
         */
        async _call(rpcid, requestData, parseResponse = false, methodName = 'API') {
            try {
                const response = await this.makeApiRequest(rpcid, requestData);
                return parseResponse ? parser(response, rpcid) : response;
            } catch (error) {
                console.error(`Error in ${methodName}:`, error);
                throw error;
            }
        }
        /**
         * Core RPC request with retry and response validation.
         *
         * Fixes #74, #85, #96, #110 — the Google batchexecute endpoint can
         * return empty bodies, HTTP errors, or responses without the expected
         * `wrb.fr` envelope (e.g. rate-limiting, timeouts).  Previously this
         * caused `JSON.parse(undefined)` to throw an opaque SyntaxError.
         * We now validate every step and retry with exponential backoff.
         *
         * @param rpcid - The RPC method identifier (e.g. `'lcxiM'`, `'EzkLib'`).
         * @param requestData - The payload to send, will be JSON-stringified.
         * @returns The parsed JSON payload from the `wrb.fr` envelope.
         */
        async makeApiRequest(rpcid, requestData) {
            const wrappedData = [[[rpcid, JSON.stringify(requestData), null, 'generic']]];
            const requestDataString = `f.req=${encodeURIComponent(JSON.stringify(wrappedData))}&at=${encodeURIComponent(windowGlobalData.at)}&`;
            const params = {
                rpcids: rpcid,
                'source-path': window.location.pathname,
                'f.sid': windowGlobalData['f.sid'],
                bl: windowGlobalData.bl,
                pageId: 'none',
                rt: 'c',
            };
            // If in locked folder, send rapt
            if (windowGlobalData.rapt)
                params['rapt'] = String(windowGlobalData.rapt);
            const paramsString = Object.keys(params)
                .map((key) => `${key}=${encodeURIComponent(params[key])}`)
                .join('&');
            const url = `https://photos.google.com${windowGlobalData.path}data/batchexecute?${paramsString}`;
            let lastError = null;
            for (let attempt = 1; attempt <= Api.MAX_RETRIES; attempt++) {
                try {
                    const response = await fetch(url, {
                        headers: {
                            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
                        },
                        body: requestDataString,
                        method: 'POST',
                        credentials: 'include',
                    });
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status} ${response.statusText}`);
                    }
                    const responseBody = await response.text();
                    if (!responseBody) {
                        throw new Error('Empty response body');
                    }
                    const jsonLines = responseBody.split('\n').filter((line) => line.includes('wrb.fr'));
                    if (jsonLines.length === 0) {
                        throw new Error('No wrb.fr envelope found in response');
                    }
                    try {
                        const parsedData = JSON.parse(jsonLines[0]);
                        // parsedData structure is typically [["rpcid", "stringified_payload", null, "generic"]]
                        // If index 2 is missing, it means the RPC itself didn't return a payload.
                        // This happens on auth errors, rate limits, or item-specific failures.
                        if (!parsedData?.[0]?.[2]) {
                            const errorCode = parsedData?.[0]?.[1];
                            const errorMsg = `Missing payload in parsed response (RPC: ${rpcid}, Google Error Code: ${errorCode ?? 'none'})`;
                            console.error(`GPTK Debug: ${errorMsg}. Full envelope:`, jsonLines[0]);
                            throw new Error(errorMsg);
                        }
                        return JSON.parse(parsedData[0][2]);
                    } catch (e) {
                        if (e.message.includes('Missing payload')) {
                            throw e;
                        }
                        console.error('GPTK Error: Failed to parse RPC payload inside wrb.fr envelope. Payload start:', String(jsonLines[0]).substring(0, 100));
                        throw e;
                    }
                }
                catch (error) {
                    if (error instanceof SyntaxError && responseBody) {
                         console.error('GPTK Debug: SyntaxError while parsing response body. Body starts with:', responseBody.substring(0, 100));
                    }
                    lastError = error instanceof Error ? error : new Error(String(error));
                    console.error(`Error in ${rpcid} request (attempt ${attempt}/${Api.MAX_RETRIES}):`, lastError.message);
                    if (attempt < Api.MAX_RETRIES) {
                        // If it's a 'Missing payload' error, it's likely a rate limit.
                        // Wait significantly longer (base 4s, 8s).
                        const isThrottled = lastError.message.includes('Missing payload');
                        const multiplier = isThrottled ? 2 : 1;
                        const delay = Api.RETRY_BASE_DELAY_MS * attempt * multiplier;
                        
                        if (isThrottled) {
                            console.warn(`GPTK: Google throttling detected (Missing payload). Retrying in ${delay/1000}s...`);
                        }
                        
                        await new Promise((resolve) => setTimeout(resolve, delay));
                    }
                }
            }
            throw lastError ?? new Error(`${rpcid} request failed after ${Api.MAX_RETRIES} attempts`);
        }
        /**
         * Retrieve library items ordered by the date they were taken (EXIF date).
         *
         * Pages backward through the timeline starting from `timestamp`.
         *
         * @param timestamp - Upper bound epoch timestamp in ms. `null` starts from the most recent.
         * @param source - `'library'` (non-archived), `'archive'`, or `null` (both).
         * @param pageId - Continuation token from a previous page's `nextPageId`.
         * @param pageSize - Number of items per page (default `500`).
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns A page of library items with `nextPageId` and `lastItemTimestamp`.
         */
        async getItemsByTakenDate(timestamp = null, source = null, pageId = null, pageSize = 500, parseResponse = true) {
            let sourceCode;
            if (source === 'library')
                sourceCode = 1;
            else if (source === 'archive')
                sourceCode = 2;
            else
                sourceCode = 3; // both
            const rpcid = 'lcxiM';
            const requestData = [pageId, timestamp, pageSize, null, 1, sourceCode];
            return this._call(rpcid, requestData, parseResponse, 'getItemsByTakenDate');
        }
        /**
         * Retrieve library items ordered by upload date (newest first).
         *
         * @param pageId - Continuation token from a previous page's `nextPageId`.
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns A page of library items with `nextPageId`.
         */
        async getItemsByUploadedDate(pageId = null, parseResponse = true) {
            const rpcid = 'EzkLib';
            const requestData = ['', [[4, 'ra', 0, 0]], pageId];
            return this._call(rpcid, requestData, parseResponse, 'getItemsByUploadedDate');
        }
        /**
         * Search the library with a text query (same as the Google Photos search bar).
         *
         * @param searchQuery - Free-text search string (e.g. `'cats'`, `'beach 2023'`).
         * @param pageId - Continuation token for paginated results.
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns A page of matching media items.
         */
        async search(searchQuery, pageId = null, parseResponse = true) {
            const rpcid = 'EzkLib';
            const requestData = [searchQuery, null, pageId];
            return this._call(rpcid, requestData, parseResponse, 'search');
        }
        /**
         * Find remote media items that match the given file hashes.
         *
         * @param hashArray - Array of file hash strings to look up.
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns Array of matched remote items with their metadata.
         */
        async getRemoteMatchesByHash(hashArray, parseResponse = true) {
            const rpcid = 'swbisb';
            const requestData = [hashArray, null, 3, 0];
            return this._call(rpcid, requestData, parseResponse, 'getRemoteMatchesByHash');
        }
        /**
         * Retrieve items marked as favorites.
         *
         * @param pageId - Continuation token for paginated results.
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns A page of favorite media items.
         */
        async getFavoriteItems(pageId = null, parseResponse = true) {
            const rpcid = 'EzkLib';
            const requestData = ['Favorites', [[5, '8', 0, 9]], pageId];
            return this._call(rpcid, requestData, parseResponse, 'getFavoriteItems');
        }
        /**
         * Retrieve items in the Locked Folder.
         *
         * Requires the page to be opened on the locked folder URL
         * so that the `rapt` authentication token is available.
         *
         * @param pageId - Continuation token for paginated results.
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns A page of locked folder items.
         */
        async getLockedFolderItems(pageId = null, parseResponse = true) {
            const rpcid = 'nMFwOc';
            const requestData = [pageId];
            return this._call(rpcid, requestData, parseResponse, 'getLockedFolderItems');
        }
        /**
         * Retrieve all shared links created by the current user.
         *
         * @param pageId - Continuation token for paginated results.
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns A page of shared links with their link IDs and item counts.
         */
        async getSharedLinks(pageId = null, parseResponse = true) {
            const rpcid = 'F2A0H';
            const requestData = [pageId, null, 2, null, 3];
            return this._call(rpcid, requestData, parseResponse, 'getSharedLinks');
        }
        /**
         * Retrieve the user's albums.
         *
         * @param pageId - Continuation token for paginated results.
         * @param pageSize - Number of albums per page (default `100`).
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns A page of albums with metadata (title, item count, shared status).
         */
        async getAlbums(pageId = null, pageSize = 100, parseResponse = true) {
            const rpcid = 'Z5xsfc';
            const requestData = [pageId, null, null, null, 1, null, null, pageSize, [2], 5];
            return this._call(rpcid, requestData, parseResponse, 'getAlbums');
        }
        /**
         * Retrieve a page of items from an album or shared link.
         *
         * @param albumMediaKey - The album's media key (or shared link ID).
         * @param pageId - Continuation token for paginated results.
         * @param authKey - Auth key for accessing shared albums you don't own.
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns A page of album items with album metadata (title, owner, members).
         */
        async getAlbumPage(albumMediaKey, pageId = null, authKey = null, parseResponse = true) {
            const rpcid = 'snAcKc';
            const requestData = [albumMediaKey, pageId, null, authKey];
            return this._call(rpcid, requestData, parseResponse, 'getAlbumPage');
        }
        /**
         * Remove items from an album (does not delete them from the library).
         *
         * @param itemAlbumMediaKeyArray - Array of item-album media keys to remove.
         * @returns The API response.
         */
        async removeItemsFromAlbum(itemAlbumMediaKeyArray) {
            const rpcid = 'ycV3Nd';
            const requestData = [itemAlbumMediaKeyArray];
            return this._call(rpcid, requestData, false, 'removeItemsFromAlbum');
        }
        /**
         * Create a new empty album.
         *
         * @param albumName - The title for the new album.
         * @returns The media key of the newly created album.
         */
        async createAlbum(albumName) {
            const rpcid = 'OXvT9d';
            const requestData = [albumName, null, 2];
            const response = await this._call(rpcid, requestData, false, 'createAlbum');
            return response?.[0]?.[0];
        }
        /**
         * Add items to an existing (non-shared) album, or create a new one.
         *
         * Provide either `albumMediaKey` (existing) or `albumName` (new).
         *
         * @param mediaKeyArray - Array of media keys to add.
         * @param albumMediaKey - The target album's media key (for existing albums).
         * @param albumName - Name for a new album to create and add items to.
         * @returns The API response.
         */
        async addItemsToAlbum(mediaKeyArray, albumMediaKey = null, albumName = null) {
            const rpcid = 'E1Cajb';
            const requestData = albumName ? [mediaKeyArray, null, albumName] : [mediaKeyArray, albumMediaKey];
            return this._call(rpcid, requestData, false, 'addItemsToAlbum');
        }
        /**
         * Add items to a shared album, or create a new shared album.
         *
         * Provide either `albumMediaKey` (existing) or `albumName` (new).
         *
         * @param mediaKeyArray - Array of media keys to add.
         * @param albumMediaKey - The target shared album's media key.
         * @param albumName - Name for a new shared album to create.
         * @returns The API response.
         */
        async addItemsToSharedAlbum(mediaKeyArray, albumMediaKey = null, albumName = null) {
            const rpcid = 'laUYf';
            const requestData = albumName
                ? [mediaKeyArray, null, albumName]
                : [albumMediaKey, [2, null, mediaKeyArray.map((id) => [[id]]), null, null, null, [1]]];
            return this._call(rpcid, requestData, false, 'addItemsToSharedAlbum');
        }
        /**
         * Reorder items within an album.
         *
         * @param albumMediaKey - The album's media key.
         * @param albumItemKeys - Array of item keys to reposition.
         * @param insertAfter - Place the items after this key. `null` moves them to the beginning.
         * @returns The API response.
         */
        async setAlbumItemOrder(albumMediaKey, albumItemKeys, insertAfter = null) {
            const rpcid = 'QD9nKf';
            const albumItemKeysArray = albumItemKeys.map((item) => [[item]]);
            const requestData = insertAfter
                ? [albumMediaKey, null, 3, null, albumItemKeysArray, [[insertAfter]]]
                : [albumMediaKey, null, 1, null, albumItemKeysArray];
            return this._call(rpcid, requestData, false, 'setAlbumItemOrder');
        }
        /**
         * Set or unset the favorite flag on items.
         *
         * @param dedupKeyArray - Array of dedup keys identifying the items.
         * @param action - `true` to favorite, `false` to unfavorite.
         * @returns The API response.
         */
        async setFavorite(dedupKeyArray, action = true) {
            const rpcid = 'Ftfh0';
            const actionCode = action ? 1 : 2;
            const mappedKeys = dedupKeyArray.map((item) => [null, item]);
            const requestData = [mappedKeys, [actionCode]];
            return this._call(rpcid, requestData, false, 'setFavorite');
        }
        /**
         * Archive or unarchive items.
         *
         * @param dedupKeyArray - Array of dedup keys identifying the items.
         * @param action - `true` to archive, `false` to unarchive.
         * @returns The API response.
         */
        async setArchive(dedupKeyArray, action = true) {
            const rpcid = 'w7TP3c';
            const actionCode = action ? 1 : 2;
            const mappedKeys = dedupKeyArray.map((item) => [null, [actionCode], [null, item]]);
            const requestData = [mappedKeys, null, 1];
            return this._call(rpcid, requestData, false, 'setArchive');
        }
        /**
         * Move items to the trash.
         *
         * Used by the legacy deduper command bridge. Keep this low-level API
         * method even if the in-page album-update panel does not expose Trash.
         *
         * @param dedupKeyArray - Array of dedup keys identifying the items.
         * @returns The API response status.
         */
        async moveItemsToTrash(dedupKeyArray) {
            const rpcid = 'XwAOJf';
            const requestData = [null, 1, dedupKeyArray, 3];
            const response = await this._call(rpcid, requestData, false, 'moveItemsToTrash');
            return response?.[0] ?? response;
        }
        /**
         * Restore items from the trash back to the library.
         *
         * Used by the legacy deduper command bridge.
         *
         * @param dedupKeyArray - Array of dedup keys identifying the trashed items.
         * @returns The API response status.
         */
        async restoreFromTrash(dedupKeyArray) {
            const rpcid = 'XwAOJf';
            const requestData = [null, 3, dedupKeyArray, 2];
            const response = await this._call(rpcid, requestData, false, 'restoreFromTrash');
            return response?.[0] ?? response;
        }
        /**
         * Move items into the Locked Folder.
         *
         * @param dedupKeyArray - Array of dedup keys identifying the items.
         * @returns The API response.
         */
        async moveToLockedFolder(dedupKeyArray) {
            const rpcid = 'StLnCe';
            const requestData = [dedupKeyArray, []];
            return this._call(rpcid, requestData, false, 'moveToLockedFolder');
        }
        /**
         * Remove items from the Locked Folder back to the library.
         *
         * @param dedupKeyArray - Array of dedup keys identifying the items.
         * @returns The API response.
         */
        async removeFromLockedFolder(dedupKeyArray) {
            const rpcid = 'Pp2Xxe';
            const requestData = [dedupKeyArray];
            return this._call(rpcid, requestData, false, 'removeFromLockedFolder');
        }
        /**
         * Get the current Google account's storage quota.
         *
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns Storage quota with total used, total available, and Google Photos usage.
         */
        async getStorageQuota(parseResponse = true) {
            const rpcid = 'EzwWhf';
            const requestData = [];
            return this._call(rpcid, requestData, parseResponse, 'getStorageQuota');
        }
        /**
         * Get download URLs for one or more media items.
         *
         * @param mediaKeyArray - Array of media keys to get download URLs for.
         * @param authKey - Auth key for shared album items.
         * @returns The download URL data.
         */
        async getDownloadUrl(mediaKeyArray, authKey = null) {
            const rpcid = 'pLFTfd';
            const requestData = [mediaKeyArray, null, authKey];
            const response = await this._call(rpcid, requestData, false, 'getDownloadUrl');
            return response[0];
        }
        /**
         * Request a download token for bulk-downloading items as a zip archive.
         *
         * Use {@link checkDownloadToken} to poll for completion.
         *
         * @param mediaKeyArray - Array of media keys to include in the download.
         * @returns The download token string.
         */
        async getDownloadToken(mediaKeyArray) {
            const rpcid = 'yCLA7';
            const mappedKeys = mediaKeyArray.map((id) => [id]);
            const requestData = [mappedKeys];
            const response = await this._call(rpcid, requestData, false, 'getDownloadToken');
            return response[0];
        }
        /**
         * Check the status of a bulk download token.
         *
         * Poll this method until `downloadUrl` is non-null (download ready).
         *
         * @param dlToken - The download token obtained from {@link getDownloadToken}.
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns Download status with filename, URL, and sizes (when ready).
         */
        async checkDownloadToken(dlToken, parseResponse = true) {
            const rpcid = 'dnv2s';
            const requestData = [[dlToken]];
            return this._call(rpcid, requestData, parseResponse, 'checkDownloadToken');
        }
        /**
         * Remove items from a shared album.
         *
         * @param albumMediaKey - The shared album's media key.
         * @param mediaKeyArray - Array of media keys to remove from the album.
         * @returns The API response.
         */
        async removeItemsFromSharedAlbum(albumMediaKey, mediaKeyArray) {
            const rpcid = 'LjmOue';
            const requestData = [
                [albumMediaKey],
                [mediaKeyArray],
                [[null, null, null, [null, [], []], null, null, null, null, null, null, null, null, null, []]],
            ];
            return this._call(rpcid, requestData, false, 'removeItemsFromSharedAlbum');
        }
        /**
         * Save shared album media to your own library.
         *
         * @param albumMediaKey - The shared album's media key.
         * @param mediaKeyArray - Array of media keys to save.
         * @returns The API response.
         */
        async saveSharedMediaToLibrary(albumMediaKey, mediaKeyArray) {
            const rpcid = 'V8RKJ';
            const requestData = [mediaKeyArray, null, albumMediaKey];
            return this._call(rpcid, requestData, false, 'saveSharedMediaToLibrary');
        }
        /**
         * Save partner-shared media to your own library.
         *
         * @param mediaKeyArray - Array of media keys from the partner sharing feed.
         * @returns The API response.
         */
        async savePartnerSharedMediaToLibrary(mediaKeyArray) {
            const rpcid = 'Es7fke';
            const mappedKeys = mediaKeyArray.map((id) => [id]);
            const requestData = [mappedKeys];
            return this._call(rpcid, requestData, false, 'savePartnerSharedMediaToLibrary');
        }
        /**
         * Retrieve media shared by a partner (partner sharing feature).
         *
         * @param partnerActorId - The partner's actor ID.
         * @param gaiaId - The partner's Gaia ID.
         * @param pageId - Continuation token for paginated results.
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns A page of partner-shared items with member info.
         */
        async getPartnerSharedMedia(partnerActorId, gaiaId, pageId, parseResponse = true) {
            const rpcid = 'e9T5je';
            const requestData = [pageId, null, [null, [[[2, 1]]], [partnerActorId], [null, gaiaId], 1]];
            return this._call(rpcid, requestData, parseResponse, 'getPartnerSharedMedia');
        }
        /**
         * Set geographic location data on one or more items.
         *
         * @param dedupKeyArray - Array of dedup keys identifying the items.
         * @param center - `[latitude, longitude]` of the location center.
         * @param visible1 - First corner of the visible map area `[lat, lng]`.
         * @param visible2 - Second corner of the visible map area `[lat, lng]`.
         * @param scale - Map zoom scale level.
         * @param gMapsPlaceId - Google Maps Place ID for the location.
         * @returns The API response.
         */
        async setItemGeoData(dedupKeyArray, center, visible1, visible2, scale, gMapsPlaceId) {
            const rpcid = 'EtUHOe';
            const mappedKeys = dedupKeyArray.map((dedupKey) => [null, dedupKey]);
            const requestData = [mappedKeys, [2, center, [visible1, visible2], [null, null, scale], gMapsPlaceId]];
            return this._call(rpcid, requestData, false, 'setItemGeoData');
        }
        /**
         * Remove geographic location data from one or more items.
         *
         * @param dedupKeyArray - Array of dedup keys identifying the items.
         * @returns The API response.
         */
        async deleteItemGeoData(dedupKeyArray) {
            const rpcid = 'EtUHOe';
            const mappedKeys = dedupKeyArray.map((dedupKey) => [null, dedupKey]);
            const requestData = [mappedKeys, [1]];
            return this._call(rpcid, requestData, false, 'deleteItemGeoData');
        }
        /**
         * Change the date/time of media items in bulk.
         *
         * @param items - Array of items to update, each with dedupKey, timestamp (seconds), and timezone (seconds).
         * @returns The API response.
         */
        async setItemsTimestamp(items) {
            const rpcid = 'DaSgWe';
            const requestData = [items.map((item) => [item.dedupKey, item.timestampSec, item.timezoneSec])];
            return this._call(rpcid, requestData, false, 'setItemsTimestamp');
        }
        /**
         * Set or update the description of a media item.
         *
         * @param dedupKey - The dedup key of the item.
         * @param description - The new description text.
         * @returns The API response.
         */
        async setItemDescription(dedupKey, description) {
            const rpcid = 'AQNOFd';
            const requestData = [null, description, dedupKey];
            return this._call(rpcid, requestData, false, 'setItemDescription');
        }
        /**
         * Get basic info for a single media item.
         *
         * Returns download URLs, quality, favorite/archive status, and more.
         *
         * @param mediaKey - The media key of the item.
         * @param albumMediaKey - Album context (for album-specific metadata).
         * @param authKey - Auth key for shared album items.
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns Item info including download URLs, timestamps, and status flags.
         */
        async getItemInfo(mediaKey, albumMediaKey = null, authKey = null, parseResponse = true) {
            const rpcid = 'VrseUb';
            const requestData = [mediaKey, null, authKey, null, albumMediaKey];
            return this._call(rpcid, requestData, parseResponse, 'getItemInfo');
        }
        /**
         * Get extended info for a single media item.
         *
         * Returns everything from {@link getItemInfo} plus EXIF camera info,
         * album membership, upload source, owner, and the "Other" description field.
         *
         * @param mediaKey - The media key of the item.
         * @param authKey - Auth key for shared album items.
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns Extended item info with source, owner, camera, albums, and geo data.
         */
        async getItemInfoExt(mediaKey, authKey = null, parseResponse = true) {
            const rpcid = 'fDcn4b';
            const requestData = [mediaKey, 1, authKey, null, 1];
            return this._call(rpcid, requestData, parseResponse, 'getItemInfoExt');
        }
        /**
         * Get media info for multiple items in a single request.
         *
         * Returns filename, description, size, quality, and space consumption
         * for each item. More efficient than calling {@link getItemInfoExt} per item.
         *
         * @param mediaKeyArray - Array of media keys (supports large batches).
         * @param parseResponse - When `false`, returns the raw API response.
         * @returns Array of bulk media info objects, one per item.
         */
        async getBatchMediaInfo(mediaKeyArray, parseResponse = true) {
            const rpcid = 'EWgK9e';
            const mappedKeys = mediaKeyArray.map((id) => [id]);
            // prettier-ignore
            const requestData = [[[mappedKeys], [[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, [], null, null, null, null, null, null, null, null, null, null, []]]]];
            const response = await this._call(rpcid, requestData, false, 'getBatchMediaInfo');
            const data = response?.[0]?.[1];
            return parseResponse ? parser(data, rpcid) : data;
        }
    }
    Api.MAX_RETRIES = 3;
    Api.RETRY_BASE_DELAY_MS = 2000;

    function dateToHHMMSS(date) {
        const options = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
        return date.toLocaleTimeString('en-GB', options);
    }
    function timeToHHMMSS(time) {
        const seconds = Math.floor((time / 1000) % 60);
        const minutes = Math.floor((time / (1000 * 60)) % 60);
        const hours = Math.floor((time / (1000 * 60 * 60)) % 24);
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        return formattedTime;
    }
    function isPatternValid(pattern) {
        try {
            new RegExp(pattern);
            return true;
        }
        catch (e) {
            return e;
        }
    }
    /** Defer execution to prevent UI blocking */
    function defer(fn) {
        return new Promise((resolve) => setTimeout(() => resolve(fn()), 0));
    }

    function log(logMessage, type = null) {
        const logPrefix = '[GPTK]';
        const now = new Date();
        const timestamp = dateToHHMMSS(now);
        // Create a new div for the log message
        const logDiv = document.createElement('div');
        logDiv.textContent = `[${timestamp}] ${logMessage}`;
        if (type)
            logDiv.classList.add(type);
        console.log(`${logPrefix} [${timestamp}] ${logMessage}`);
        // Append the log message to the log container
        try {
            const logContainer = document.querySelector('#logArea');
            if (logContainer) {
                logContainer.appendChild(logDiv);
                const autoScrollCheckbox = document.querySelector('#autoScroll');
                if (autoScrollCheckbox?.checked)
                    logDiv.scrollIntoView();
            }
        }
        catch (error) {
            console.error(`${logPrefix} [${timestamp}] ${String(error)}`);
        }
    }

    function splitArrayIntoChunks(arr, chunkSize = 500) {
        chunkSize = Math.max(1, Math.floor(chunkSize));
        const chunks = [];
        for (let i = 0; i < arr.length; i += chunkSize) {
            chunks.push(arr.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Fetch an image URL via the bridge content script (ISOLATED world), which
     * is not subject to the CORS restrictions that block direct fetch() calls
     * from the injected MAIN-world toolkit script.
     *
     * Flow: MAIN world → window.postMessage(gptkFetchImage) → ISOLATED bridge
     *       → fetch() → window.postMessage(gptkFetchImageResult) → MAIN world
     *
     * @param imageUrl - URL to fetch
     * @param timeoutMs - Maximum wait time in ms (default 15 000)
     * @returns Promise resolving to { base64: string, mimeType: string }
     */
    function fetchImageViaBridge(imageUrl, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            const requestId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const timer = setTimeout(() => {
                window.removeEventListener('message', handler);
                reject(new Error('Image fetch via bridge timed out'));
            }, timeoutMs);
            function handler(e) {
                if (e.source !== window) return;
                const msg = e.data;
                if (msg?.app === 'GPD' && msg.action === 'gptkFetchImageResult' && msg.requestId === requestId) {
                    clearTimeout(timer);
                    window.removeEventListener('message', handler);
                    if (msg.error) {
                        reject(new Error(msg.error));
                    } else {
                        resolve({ base64: msg.base64, mimeType: msg.mimeType });
                    }
                }
            }
            window.addEventListener('message', handler);
            window.postMessage({ app: 'GPD', action: 'gptkFetchImage', requestId, url: imageUrl }, '*');
        });
    }

    function fetchAiDescriptionViaBridge(provider, imageUrl, timeoutMs = 120000) {
        return new Promise((resolve, reject) => {
            const requestId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const timer = setTimeout(() => {
                window.removeEventListener('message', handler);
                reject(new Error('AI description request timed out'));
            }, timeoutMs);
            function handler(e) {
                if (e.source !== window) return;
                const msg = e.data;
                if (msg?.app === 'GPD' && msg.action === 'gptkAiDescribeResult' && msg.requestId === requestId) {
                    clearTimeout(timer);
                    window.removeEventListener('message', handler);
                    if (msg.error) {
                        reject(new Error(msg.error));
                    }
                    else {
                        const text = msg.data?.text?.trim();
                        if (!text) {
                            reject(new Error('AI provider returned no text'));
                            return;
                        }
                        resolve(text);
                    }
                }
            }
            window.addEventListener('message', handler);
            window.postMessage({ app: 'GPD', action: 'gptkAiDescribeRequest', requestId, provider, imageUrl }, '*');
        });
    }

    async function callGeminiVision(imageUrl) {
        return await fetchAiDescriptionViaBridge('gemini', imageUrl);
    }

    function fetchOllamaViaBridge(request, timeoutMs = 90000) {
        return new Promise((resolve, reject) => {
            const requestId = `ollama-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const timer = setTimeout(() => {
                window.removeEventListener('message', handler);
                reject(new Error('Ollama request timed out'));
            }, timeoutMs);
            function handler(e) {
                if (e.source !== window) return;
                const msg = e.data;
                if (msg?.app === 'GPD' && msg.action === 'gptkOllamaResult' && msg.requestId === requestId) {
                    clearTimeout(timer);
                    window.removeEventListener('message', handler);
                    if (msg.error) {
                        reject(new Error(msg.error));
                    }
                    else {
                        resolve(msg.data);
                    }
                }
            }
            window.addEventListener('message', handler);
            window.postMessage({ app: 'GPD', action: 'gptkOllamaRequest', requestId, request }, '*');
        });
    }

    async function fetchOllamaModels(settings) {
        const data = await fetchOllamaViaBridge({
            baseUrl: settings.ollamaBaseUrl,
            path: '/api/tags',
            method: 'GET',
            timeoutMs: 15000,
        }, 20000);
        return Array.isArray(data?.models) ? data.models.map((model) => model.name).filter(Boolean) : [];
    }

    async function callOllamaVision(settings, imageUrl) {
        const model = String(settings.ollamaModel ?? '').trim();
        if (!model) {
            throw new Error('Ollama model is not selected');
        }
        return await fetchAiDescriptionViaBridge('ollama', imageUrl);
    }

    async function callAiDescription(settings, imageUrl) {
        const provider = settings?.aiProvider ?? apiSettingsDefault.aiProvider;
        if (provider === 'ollama') {
            if (!settings?.ollamaBaseUrl || !settings?.ollamaModel) {
                throw new Error('Ollama server URL and model are required');
            }
            return await callOllamaVision(settings, imageUrl);
        }
        if (!settings?.hasGeminiApiKey && !settings?.geminiApiKey) {
            throw new Error('No Gemini API key set');
        }
        return await callGeminiVision(imageUrl);
    }

    // Default settings
    const apiSettingsDefault = {
        maxConcurrentSingleApiReq: 3,
        maxConcurrentBatchApiReq: 3,
        operationSize: 250,
        lockedFolderOpSize: 100,
        infoSize: 5000,
        aiProvider: 'gemini',
        geminiApiKey: '',
        hasGeminiApiKey: false,
        // Minimum delay between Gemini API calls (ms). Keeps usage under the
        // free-tier 15 RPM cap (1 req / 4 s = 15 RPM). Raise if you see 429s.
        geminiDelayMs: 4000,
        ollamaBaseUrl: 'http://127.0.0.1:11434',
        ollamaModel: '',
        ollamaModels: [],
        ollamaDelayMs: 1000,
        ollamaApiKey: '',
        hasOllamaApiKey: false,
    };

    /**
     * Date parser utility inspired by exiftool's approach.
     *
     * Extracts date/time from filenames using a sequential digit extraction algorithm:
     * 1. First 4 consecutive digits → Year (YYYY)
     * 2. Next 2 digits → Month (MM)
     * 3. Next 2 digits → Day (DD)
     * 4. Next 2 digits → Hour (HH) [optional]
     * 5. Next 2 digits → Minute (MM) [optional]
     * 6. Next 2 digits → Second (SS) [optional]
     *
     * This is separator-agnostic, meaning any non-digit characters between
     * numbers are ignored (e.g., "2023-05-15", "20230515", "2023_05_15" all work).
     *
     * @example
     * parseDateFromFilename("IMG_20230515_143022.jpg") // → 2023-05-15T14:30:22
     * parseDateFromFilename("Screenshot_2023-05-15-14-30-22.png") // → 2023-05-15T14:30:22
     * parseDateFromFilename("photo_20230515.jpg") // → 2023-05-15T00:00:00
     */
    /**
     * Extract all digit sequences from a string.
     * Returns an array of { value: string, index: number } objects.
     */
    function extractDigitSequences(str) {
        const sequences = [];
        const regex = /\d+/g;
        let match;
        while ((match = regex.exec(str)) !== null) {
            sequences.push({ value: match[0], index: match.index });
        }
        return sequences;
    }
    /**
     * Validate that the extracted values form a valid date.
     */
    function isValidDate(year, month, day, hour, minute, second) {
        // Basic range checks
        if (year < 1900 || year > 2100)
            return false;
        if (month < 1 || month > 12)
            return false;
        if (day < 1 || day > 31)
            return false;
        if (hour < 0 || hour > 23)
            return false;
        if (minute < 0 || minute > 59)
            return false;
        if (second < 0 || second > 59)
            return false;
        // Check if the date is actually valid (handles Feb 30, etc.)
        const date = new Date(year, month - 1, day, hour, minute, second);
        return (date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day &&
            date.getHours() === hour &&
            date.getMinutes() === minute &&
            date.getSeconds() === second);
    }
    /**
     * Parse a date from a filename using exiftool's sequential digit extraction approach.
     *
     * The algorithm:
     * 1. Extract all digit sequences from the filename
     * 2. Find a 4-digit sequence that could be a valid year (1900-2100)
     * 3. Look for subsequent 2-digit sequences for month, day, hour, minute, second
     * 4. Validate the resulting date
     *
     * @param filename - The filename to parse (can include path and extension)
     * @returns ParsedDate object if a valid date was found, null otherwise
     */
    function parseDateFromFilename(filename) {
        // Extract just the filename without path
        const baseName = filename.replace(/^.*[\\/]/, '');
        // Extract all digit sequences
        const sequences = extractDigitSequences(baseName);
        if (sequences.length === 0)
            return null;
        // Try different starting points for the year
        for (let startIdx = 0; startIdx < sequences.length; startIdx++) {
            const result = tryParseFromSequence(sequences, startIdx);
            if (result)
                return result;
        }
        return null;
    }
    /**
     * Try to parse a date starting from a specific sequence index.
     */
    function tryParseFromSequence(sequences, startIdx) {
        const firstSeq = sequences[startIdx];
        // Case 1: First sequence is exactly 4 digits (year)
        if (firstSeq.value.length === 4) {
            return tryParseWithSeparateComponents(sequences, startIdx);
        }
        // Case 2: First sequence is 8 digits (YYYYMMDD) - look for separate time sequence
        if (firstSeq.value.length === 8) {
            const dateResult = tryParseConcatenatedFormat(firstSeq.value);
            if (dateResult && startIdx + 1 < sequences.length) {
                // Check if next sequence could be time (HHMMSS or 6 digits)
                const nextSeq = sequences[startIdx + 1];
                if (nextSeq.value.length === 6) {
                    const timeResult = tryParseTimeSequence(nextSeq.value);
                    if (timeResult) {
                        // Combine date and time
                        const fullDate = new Date(dateResult.year, dateResult.month - 1, dateResult.day, timeResult.hour, timeResult.minute, timeResult.second);
                        return {
                            ...dateResult,
                            hour: timeResult.hour,
                            minute: timeResult.minute,
                            second: timeResult.second,
                            timestamp: fullDate.getTime(),
                        };
                    }
                }
            }
            return dateResult;
        }
        // Case 3: First sequence is 14 digits (YYYYMMDDHHMMSS)
        if (firstSeq.value.length === 14) {
            return tryParseConcatenatedFormat(firstSeq.value);
        }
        // Case 4: First sequence is more than 8 but less than 14 digits
        if (firstSeq.value.length > 8 && firstSeq.value.length < 14) {
            return tryParseConcatenatedFormat(firstSeq.value);
        }
        return null;
    }
    /**
     * Parse time from a 6-digit sequence (HHMMSS).
     */
    function tryParseTimeSequence(digits) {
        if (digits.length !== 6)
            return null;
        const hour = parseInt(digits.substring(0, 2), 10);
        const minute = parseInt(digits.substring(2, 4), 10);
        const second = parseInt(digits.substring(4, 6), 10);
        // Validate time components
        if (hour < 0 || hour > 23)
            return null;
        if (minute < 0 || minute > 59)
            return null;
        if (second < 0 || second > 59)
            return null;
        return { hour, minute, second };
    }
    /**
     * Parse date when digits are in a single concatenated sequence.
     * Handles formats like: 20230515, 20230515143022
     */
    function tryParseConcatenatedFormat(digits) {
        if (digits.length < 8)
            return null;
        const year = parseInt(digits.substring(0, 4), 10);
        const month = parseInt(digits.substring(4, 6), 10);
        const day = parseInt(digits.substring(6, 8), 10);
        let hour = 0;
        let minute = 0;
        let second = 0;
        if (digits.length >= 10) {
            hour = parseInt(digits.substring(8, 10), 10);
        }
        if (digits.length >= 12) {
            minute = parseInt(digits.substring(10, 12), 10);
        }
        if (digits.length >= 14) {
            second = parseInt(digits.substring(12, 14), 10);
        }
        if (!isValidDate(year, month, day, hour, minute, second)) {
            return null;
        }
        const date = new Date(year, month - 1, day, hour, minute, second);
        return {
            timestamp: date.getTime(),
            year,
            month,
            day,
            hour,
            minute,
            second,
        };
    }
    /**
     * Parse date when components are separated (e.g., 2023-05-15-14-30-22).
     */
    function tryParseWithSeparateComponents(sequences, yearIdx) {
        if (yearIdx >= sequences.length)
            return null;
        const yearSeq = sequences[yearIdx];
        // Year must be exactly 4 digits
        if (yearSeq.value.length !== 4)
            return null;
        const year = parseInt(yearSeq.value, 10);
        if (year < 1900 || year > 2100)
            return null;
        // Look for subsequent components
        let month = 1;
        let day = 1;
        let hour = 0;
        let minute = 0;
        let second = 0;
        let foundMonth = false;
        let foundDay = false;
        // Process remaining sequences
        let seqIdx = yearIdx + 1;
        // Month
        if (seqIdx < sequences.length) {
            const monthVal = extractTwoDigitValue(sequences[seqIdx].value);
            if (monthVal !== null && monthVal >= 1 && monthVal <= 12) {
                month = monthVal;
                foundMonth = true;
                seqIdx++;
            }
        }
        // Day
        if (foundMonth && seqIdx < sequences.length) {
            const dayVal = extractTwoDigitValue(sequences[seqIdx].value);
            if (dayVal !== null && dayVal >= 1 && dayVal <= 31) {
                day = dayVal;
                foundDay = true;
                seqIdx++;
            }
        }
        // Hour
        if (foundDay && seqIdx < sequences.length) {
            const hourVal = extractTwoDigitValue(sequences[seqIdx].value);
            if (hourVal !== null && hourVal >= 0 && hourVal <= 23) {
                hour = hourVal;
                seqIdx++;
            }
        }
        // Minute
        if (seqIdx < sequences.length && hour > 0) {
            const minuteVal = extractTwoDigitValue(sequences[seqIdx].value);
            if (minuteVal !== null && minuteVal >= 0 && minuteVal <= 59) {
                minute = minuteVal;
                seqIdx++;
            }
        }
        // Second
        if (seqIdx < sequences.length && minute > 0) {
            const secondVal = extractTwoDigitValue(sequences[seqIdx].value);
            if (secondVal !== null && secondVal >= 0 && secondVal <= 59) {
                second = secondVal;
            }
        }
        // Must have at least year, month, and day
        if (!foundMonth || !foundDay)
            return null;
        if (!isValidDate(year, month, day, hour, minute, second)) {
            return null;
        }
        const date = new Date(year, month - 1, day, hour, minute, second);
        return {
            timestamp: date.getTime(),
            year,
            month,
            day,
            hour,
            minute,
            second,
        };
    }
    /**
     * Extract a 2-digit value from a sequence.
     * If the sequence is longer, only the first 2 digits are used.
     */
    function extractTwoDigitValue(seq) {
        if (seq.length < 2)
            return null;
        const val = parseInt(seq.substring(0, 2), 10);
        return isNaN(val) ? null : val;
    }
    /**
     * Format a ParsedDate as an ISO-like string for display.
     */
    function formatParsedDate(parsed) {
        const pad = (n) => n.toString().padStart(2, '0');
        return `${parsed.year}-${pad(parsed.month)}-${pad(parsed.day)} ${pad(parsed.hour)}:${pad(parsed.minute)}:${pad(parsed.second)}`;
    }

    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
    /**
     * High-level API utilities with pagination, concurrency control, and bulk operations.
     *
     * Wraps the low-level {@link Api} methods with automatic chunking, retry,
     * and album overflow handling.
     *
     * Exposed globally as `gptkApiUtils` for console scripting:
     * ```js
     * const albums = await gptkApiUtils.getAllAlbums();
     * const items  = await gptkApiUtils.getAllMediaInAlbum(albums[0].mediaKey);
     * ```
     */
    class ApiUtils {
        constructor(core, settings) {
            this.api = new Api();
            this.core = core;
            const resolvedSettings = settings ?? apiSettingsDefault;
            this.maxConcurrentSingleApiReq = Math.floor(Number(resolvedSettings.maxConcurrentSingleApiReq));
            this.maxConcurrentBatchApiReq = Math.floor(Number(resolvedSettings.maxConcurrentBatchApiReq));
            this.operationSize = Math.floor(Number(resolvedSettings.operationSize));
            this.lockedFolderOpSize = Math.floor(Number(resolvedSettings.lockedFolderOpSize));
            this.infoSize = Math.floor(Number(resolvedSettings.infoSize));
        }
        async executeWithConcurrency(apiMethod, operationSize, itemsArray, ...args) {
            const promisePool = new Set();
            const results = [];
            const chunkedItems = splitArrayIntoChunks(itemsArray, operationSize);
            let collectResults = true;
            if (args.length > 0 &&
                args[0] &&
                typeof args[0] === 'object' &&
                !Array.isArray(args[0]) &&
                Object.prototype.hasOwnProperty.call(args[0], 'collectResults')) {
                collectResults = args[0].collectResults !== false;
                args = args.slice(1);
            }
            // FIX #9: Use strict equality
            const maxConcurrentApiReq = operationSize === 1 ? this.maxConcurrentSingleApiReq : this.maxConcurrentBatchApiReq;
            for (const chunk of chunkedItems) {
                if (!this.core.isProcessRunning)
                    return results;
                while (promisePool.size >= maxConcurrentApiReq) {
                    await Promise.race(promisePool);
                }
                // FIX #9: Use strict equality
                if (operationSize !== 1)
                    log(`Processing ${chunk.length} items`);
                const promise = apiMethod.call(this.api, chunk, ...args);
                promisePool.add(promise);
                promise
                    .then((result) => {
                        if (!collectResults) {
                            return;
                        }
                        // FIX #81/#100/#108: Guard against null/non-iterable results.
                        // When the API returns null (rate-limited, error response),
                        // `results.push(...null)` threw "result is not iterable".
                        if (result == null) {
                            log(`Null result from ${apiMethod.name}, skipping chunk`, 'error');
                        }
                        else if (!Array.isArray(result)) {
                            log(`Non-array result from ${apiMethod.name}, skipping chunk`, 'error');
                        }
                        else {
                            results.push(...result);
                            if (operationSize === 1 && results.length % 100 === 0) {
                                log(`Processed ${results.length} items`);
                            }
                        }
                    })
                    .catch((error) => {
                        log(`${apiMethod.name} Api error ${String(error)}`, 'error');
                    })
                    .finally(() => {
                        promisePool.delete(promise);
                    });
            }
            await Promise.all(promisePool);
            return results;
        }
        async getAllItems(apiMethod, ...args) {
            const items = [];
            let nextPageId;
            do {
                if (!this.core.isProcessRunning)
                    return items;
                try {
                    const page = await apiMethod.call(this.api, ...args, nextPageId);
                    if (page?.items && page.items.length > 0) {
                        log(`Found ${page.items.length} items`);
                        items.push(...page.items);
                    }
                    nextPageId = page?.nextPageId;
                }
                catch (error) {
                    console.error('Error fetching page:', error);
                    throw error;
                }
            } while (nextPageId);
            return items;
        }
        /**
         * Fetch all albums across all pages.
         *
         * @returns Array of all albums in the user's library.
         */
        async getAllAlbums() {
            return await this.getAllItems(this.api.getAlbums.bind(this.api));
        }
        /**
         * Fetch all shared links across all pages.
         *
         * @returns Array of all shared links created by the user.
         */
        async getAllSharedLinks() {
            return await this.getAllItems(this.api.getSharedLinks.bind(this.api));
        }
        /**
         * Fetch all media items from a shared link across all pages.
         *
         * @param sharedLinkId - The shared link's ID.
         * @returns Array of all media items in the shared link.
         */
        async getAllMediaInSharedLink(sharedLinkId) {
            return await this.getAllContextualAlbumItems(sharedLinkId);
        }
        /**
         * Fetch all media items from an album across all pages.
         *
         * @param albumMediaKey - The album's media key.
         * @returns Array of all media items in the album.
         */
        async getAllMediaInAlbum(albumMediaKey) {
            return await this.getAllContextualAlbumItems(albumMediaKey);
        }
        async getAllContextualAlbumItems(albumMediaKey, authKey = null) {
            const items = [];
            let nextPageId;
            let resolvedAuthKey = authKey;
            do {
                if (!this.core.isProcessRunning)
                    return items;
                try {
                    const page = await this.api.getAlbumPage(albumMediaKey, nextPageId, resolvedAuthKey);
                    if (page?.items && page.items.length > 0) {
                        log(`Found ${page.items.length} items`);
                        const contextualItems = page.items.map((item) => ({
                            ...item,
                            sourceAlbumMediaKey: albumMediaKey,
                            sourceAlbumAuthKey: page.authKey ?? resolvedAuthKey ?? null,
                            sourceAlbumTitle: page.title ?? null,
                        }));
                        items.push(...contextualItems);
                    }
                    resolvedAuthKey = page?.authKey ?? resolvedAuthKey;
                    nextPageId = page?.nextPageId;
                }
                catch (error) {
                    log(`Error fetching page, skipping: ${error instanceof Error ? error.message : String(error)}`, 'error');
                    break;
                }
            } while (nextPageId);
            return items;
        }
        /**
         * Fetch all favorite items across all pages.
         *
         * @returns Array of all favorite media items.
         */
        async getAllFavoriteItems() {
            return await this.getAllItems(this.api.getFavoriteItems.bind(this.api));
        }
        /**
         * Fetch all items matching a search query across all pages.
         *
         * @param searchQuery - Free-text search string.
         * @returns Array of all matching media items.
         */
        async getAllSearchItems(searchQuery) {
            return await this.getAllItems(this.api.search.bind(this.api), searchQuery);
        }
        /**
         * Fetch all items in the Locked Folder across all pages.
         *
         * @returns Array of all locked folder media items.
         */
        async getAllLockedFolderItems() {
            return await this.getAllItems(this.api.getLockedFolderItems.bind(this.api));
        }
        /**
         * Move items into the Locked Folder in batches.
         *
         * @param mediaItems - Array of media items to move.
         */
        async moveToLockedFolder(mediaItems) {
            log(`Moving ${mediaItems.length} items to locked folder`);
            const dedupKeyArray = mediaItems.map((item) => item.dedupKey);
            await this.executeWithConcurrency(this.api.moveToLockedFolder.bind(this.api), this.lockedFolderOpSize, dedupKeyArray, { collectResults: false });
        }
        /**
         * Remove items from the Locked Folder in batches.
         *
         * @param mediaItems - Array of media items to remove from the locked folder.
         */
        async removeFromLockedFolder(mediaItems) {
            log(`Moving ${mediaItems.length} items out of locked folder`);
            const dedupKeyArray = mediaItems.map((item) => item.dedupKey);
            await this.executeWithConcurrency(this.api.removeFromLockedFolder.bind(this.api), this.lockedFolderOpSize, dedupKeyArray, { collectResults: false });
        }
        /**
         * Archive items in batches. Items already archived are skipped.
         *
         * @param mediaItems - Array of media items to archive.
         */
        async sendToArchive(mediaItems) {
            log(`Sending ${mediaItems.length} items to archive`);
            const filtered = mediaItems.filter((item) => item?.isArchived !== true);
            if (filtered.length === 0) {
                log('All target items are already archived');
                return;
            }
            const dedupKeyArray = filtered.map((item) => item.dedupKey);
            await this.executeWithConcurrency(this.api.setArchive.bind(this.api), this.operationSize, dedupKeyArray, { collectResults: false }, true);
        }
        /**
         * Unarchive items in batches. Items not archived are skipped.
         *
         * @param mediaItems - Array of media items to unarchive.
         */
        async unArchive(mediaItems) {
            log(`Removing ${mediaItems.length} items from archive`);
            const filtered = mediaItems.filter((item) => item?.isArchived !== false);
            if (filtered.length === 0) {
                log('All target items are not archived');
                return;
            }
            const dedupKeyArray = filtered.map((item) => item.dedupKey);
            await this.executeWithConcurrency(this.api.setArchive.bind(this.api), this.operationSize, dedupKeyArray, { collectResults: false }, false);
        }
        /**
         * Mark items as favorites in batches. Items already favorited are skipped.
         *
         * @param mediaItems - Array of media items to favorite.
         */
        async setAsFavorite(mediaItems) {
            log(`Setting ${mediaItems.length} items as favorite`);
            const filtered = mediaItems.filter((item) => item?.isFavorite !== true);
            if (filtered.length === 0) {
                log('All target items are already favorite');
                return;
            }
            const dedupKeyArray = filtered.map((item) => item.dedupKey);
            await this.executeWithConcurrency(this.api.setFavorite.bind(this.api), this.operationSize, dedupKeyArray, { collectResults: false }, true);
        }
        /**
         * Remove favorite status from items in batches. Non-favorited items are skipped.
         *
         * @param mediaItems - Array of media items to unfavorite.
         */
        async unFavorite(mediaItems) {
            log(`Removing ${mediaItems.length} items from favorites`);
            const filtered = mediaItems.filter((item) => item?.isFavorite !== false);
            if (filtered.length === 0) {
                log('All target items are not favorite');
                return;
            }
            const dedupKeyArray = filtered.map((item) => item.dedupKey);
            await this.executeWithConcurrency(this.api.setFavorite.bind(this.api), this.operationSize, dedupKeyArray, { collectResults: false }, false);
        }
        /**
         * Add items to an existing album with automatic overflow handling.
         *
         * If the album would exceed the 20,000 item limit, overflow items are
         * automatically placed into sequentially numbered albums (e.g. "Album (2)").
         *
         * @param mediaItems - Array of media items to add.
         * @param targetAlbum - The target album object.
         * @param preserveOrder - When `true`, reorders album items to match the input order.
         */
        async addToExistingAlbum(mediaItems, targetAlbum, preserveOrder = false) {
            const existingCount = targetAlbum.itemCount ?? 0;
            const remaining = Math.max(0, ApiUtils.ALBUM_ITEM_LIMIT - existingCount);
            if (mediaItems.length <= remaining) {
                // Everything fits in the target album
                await this.addItemsToSingleAlbum(mediaItems, targetAlbum, preserveOrder);
            }
            else {
                // Split: fill the current album, then overflow into new albums
                const firstBatch = mediaItems.slice(0, remaining);
                const overflow = mediaItems.slice(remaining);
                if (firstBatch.length > 0) {
                    log(`Album "${targetAlbum.title}" can accept ${remaining} more items (limit: ${ApiUtils.ALBUM_ITEM_LIMIT})`);
                    await this.addItemsToSingleAlbum(firstBatch, targetAlbum, preserveOrder);
                }
                // Create overflow albums
                const overflowChunks = splitArrayIntoChunks(overflow, ApiUtils.ALBUM_ITEM_LIMIT);
                for (let i = 0; i < overflowChunks.length; i++) {
                    const chunk = overflowChunks[i];
                    const overflowName = `${targetAlbum.title} (${i + 2})`;
                    log(`Creating overflow album "${overflowName}" for ${chunk.length} items`);
                    const newAlbumMediaKey = await this.api.createAlbum(overflowName);
                    const overflowAlbum = {
                        title: overflowName,
                        isShared: false,
                        mediaKey: newAlbumMediaKey,
                        itemCount: 0,
                    };
                    await this.addItemsToSingleAlbum(chunk, overflowAlbum, preserveOrder);
                }
            }
        }
        async addItemsToSingleAlbum(mediaItems, targetAlbum, preserveOrder) {
            log(`Adding ${mediaItems.length} items to album "${targetAlbum.title}"`);
            const mediaKeyArray = mediaItems.map((item) => item.mediaKey);
            const addItemFunction = targetAlbum.isShared
                ? this.api.addItemsToSharedAlbum.bind(this.api)
                : this.api.addItemsToAlbum.bind(this.api);
            await this.executeWithConcurrency(addItemFunction, this.operationSize, mediaKeyArray, { collectResults: false }, targetAlbum.mediaKey);
            if (preserveOrder) {
                log('Setting album item order');
                const albumItems = await this.getAllMediaInAlbum(targetAlbum.mediaKey);
                const orderMap = new Map();
                mediaItems.forEach((item, index) => {
                    orderMap.set(item.dedupKey, index);
                });
                const sortedAlbumItems = [...albumItems].sort((a, b) => {
                    const indexA = orderMap.get(a.dedupKey) ?? Infinity;
                    const indexB = orderMap.get(b.dedupKey) ?? Infinity;
                    return indexA - indexB;
                });
                const sortedMediaKeys = sortedAlbumItems.map((item) => item.mediaKey);
                for (const key of sortedMediaKeys.reverse()) {
                    await this.api.setAlbumItemOrder(targetAlbum.mediaKey, [key]);
                }
            }
        }

        /**
         * Get media info (filename, size, quality, etc.) for items in concurrent batches.
         *
         * @param mediaItems - Array of media items to get info for.
         * @returns Array of bulk media info objects.
         */
        async getBatchMediaInfoChunked(mediaItems) {
            log("Getting items' media info");
            const mediaKeyArray = mediaItems.map((item) => item.mediaKey);
            const mediaInfoData = await this.executeWithConcurrency(this.api.getBatchMediaInfo.bind(this.api), this.infoSize, mediaKeyArray);
            return mediaInfoData;
        }
        async resolveOneLibraryMutationItem(mediaItems) {
            try {
                const item = mediaItems[0];
                if (!item?.mediaKey) {
                    return [];
                }
                const itemInfo = await this.api.getItemInfo(item.mediaKey, item.sourceAlbumMediaKey ?? null, item.sourceAlbumAuthKey ?? null);
                if (!itemInfo?.mediaKey || !itemInfo?.dedupKey) {
                    return [];
                }
                return [{
                        ...item,
                        dedupKey: itemInfo.dedupKey,
                        savedToYourPhotos: itemInfo.savedToYourPhotos,
                        isArchived: itemInfo.isArchived,
                    }];
            }
            catch (error) {
                console.error('Error resolving library mutation item:', error);
                return [];
            }
        }
        async resolveLibraryMutationItems(mediaItems, actionLabel) {
            const needsResolution = mediaItems.some((item) => !item?.dedupKey || item?.isArchived === undefined || item?.savedToYourPhotos === undefined);
            if (!needsResolution) {
                return mediaItems;
            }
            log(`Resolving library item identities for ${actionLabel}`);
            return await this.executeWithConcurrency(this.resolveOneLibraryMutationItem.bind(this), 1, mediaItems);
        }
        async copyOneDescriptionFromOther(mediaItems) {
            // This method returns an array containing a single boolean indicating
            // whether the description was copied.
            try {
                const item = mediaItems[0];
                const itemInfoExt = await this.api.getItemInfoExt(item.mediaKey);
                // Only copy the description if the Google Photos description field
                // is empty and the 'Other' description is non-empty.
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- intentional: empty string should be falsy
                if (itemInfoExt.descriptionFull || !itemInfoExt.other) {
                    return [false];
                }
                // Adding a zero-width space (U+200B) since the Google Photos API
                // doesn't allow the description to be identical to the "Other" field.
                const description = itemInfoExt.other + '\u200B';
                await this.api.setItemDescription(item.dedupKey, description);
                return [true];
            }
            catch (error) {
                console.error('Error in copyOneDescriptionFromOther:', error);
                throw error;
            }
        }
        /**
         * Copy the EXIF "Other" description field to the Google Photos description.
         *
         * Only copies when the Google Photos description is empty and "Other" is non-empty.
         *
         * @param mediaItems - Array of media items to process.
         */
        async copyDescriptionFromOther(mediaItems) {
            log(`Copying up to ${mediaItems.length} descriptions from 'Other' field`);
            const results = await this.executeWithConcurrency(this.copyOneDescriptionFromOther.bind(this), 1, mediaItems);
            log(`Copied ${results.filter(Boolean).length} descriptions from 'Other' field`);
        }
        /**
         * Generate and set an AI description for a single media item.
         *
         * Skips items that already have a description. Fetches the photo thumbnail,
         * sends it to the selected AI provider, and writes the result to Google Photos.
         * After a successful write, waits the provider-specific delay before returning
         * so the caller naturally paces requests.
         *
         * @param mediaItems - Single-element array (required by executeWithConcurrency).
         * @returns [true] if description was set, [false] if skipped or errored.
         */
        async aiDescribeOneItem(mediaItems, index = 1, total = 1) {
            try {
                const item = mediaItems[0];
                const settings = getFromStorage('apiSettings');
                const provider = settings?.aiProvider ?? apiSettingsDefault.aiProvider;
                if (provider === 'gemini' && !settings?.hasGeminiApiKey && !settings?.geminiApiKey) {
                    log('AI Describe: No Gemini API key set. Open the extension hub and save your key.', 'error');
                    this.core.isProcessRunning = false;
                    return [false];
                }
                if (provider === 'ollama' && (!settings?.ollamaBaseUrl || !settings?.ollamaModel)) {
                    log('AI Describe: Ollama server URL and model are required. Open Advanced Settings and fetch/select a model.', 'error');
                    this.core.isProcessRunning = false;
                    return [false];
                }
                // Items that are skipped do not consume the delay; only real AI calls do.
                const delaySetting = provider === 'ollama'
                    ? settings?.ollamaDelayMs ?? apiSettingsDefault.ollamaDelayMs
                    : settings?.geminiDelayMs ?? apiSettingsDefault.geminiDelayMs;
                const delayMs = parseInt(String(delaySetting), 10) || 0;
                // Check if item already has a description.
                // Also use the authoritative dedupKey from this response — the one
                // on the list-fetched item can be stale or undefined depending on source.
                const itemInfoExt = await this.api.getItemInfoExt(item.mediaKey);
                const dedupKey = itemInfoExt.dedupKey || item.dedupKey;
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                if (itemInfoExt.descriptionFull) {
                    return [false]; // Skip: already described — no delay needed
                }
                if (!dedupKey) {
                    log(`AI Describe [${index}/${total}]: Could not resolve dedupKey for item ${item.mediaKey}, skipping`, 'error');
                    return [false];
                }
                
                log(`AI Describe [${index}/${total}]: Sending to ${provider}...`);
                
                // Build sized thumbnail URL (1024px max side, no watermark, no auth requirement).
                // The -k-no suffix removes Google's auth requirement so the URL can be fetched
                // without session cookies. Without it, the raw thumb URL returns 403.
                if (!item.thumb) {
                    log(`AI Describe [${index}/${total}]: No thumbnail URL for item ${item.mediaKey}, skipping`, 'error');
                    return [false];
                }
                // Strip any existing size/flag params before appending our own
                const thumbBase = item.thumb.includes('=') ? item.thumb.split('=')[0] : item.thumb;
                const imageUrl = `${thumbBase}=w1024-h1024-k-no`;
                let description = await callAiDescription(settings, imageUrl);
                
                // Sanitize AI output: strip markdown formatting that Google Photos
                // silently rejects (bold, italic, headers, bullet markers, etc.)
                description = description
                    .replace(/\*\*([^*]+)\*\*/g, '$1')   // **bold**
                    .replace(/\*([^*]+)\*/g, '$1')        // *italic*
                    .replace(/__([^_]+)__/g, '$1')        // __bold__
                    .replace(/_([^_]+)_/g, '$1')          // _italic_
                    .replace(/^#{1,6}\s+/gm, '')          // # headers
                    .replace(/^[-*+]\s+/gm, '')           // - bullet points
                    .replace(/^\d+\.\s+/gm, '')           // 1. numbered lists
                    .replace(/`([^`]+)`/g, '$1')          // `code`
                    .replace(/\n{3,}/g, '\n\n')           // collapse excess newlines
                    .trim();
                
                const shortDesc = description.length > 60 ? description.substring(0, 60) + '...' : description;
                log(`AI Describe [${index}/${total}]: Generated "${shortDesc}"`);
                
                // Write description to Google Photos using the authoritative dedupKey
                await this.api.setItemDescription(dedupKey, description);
                
                // Verify the write actually persisted
                const verifyInfo = await this.api.getItemInfoExt(item.mediaKey);
                if (!verifyInfo.descriptionFull) {
                    log(`AI Describe [${index}/${total}]: ⚠ Write may not have persisted — verify manually`, 'error');
                } else {
                    log(`AI Describe [${index}/${total}]: ✓ Saved`);
                }
                
                if (delayMs > 0) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }
                return [true];
            }
            catch (error) {
                console.error('Error in aiDescribeOneItem:', error);
                log(`AI Describe [${index}/${total}] error: ${String(error)}`, 'error');
                return [false];
            }
        }
        /**
         * Generate AI descriptions for multiple media items.
         *
         * Items that already have a description are skipped. Processes one item
         * at a time (concurrency=1) and enforces a configurable delay between
         * successful provider calls.
         *
         * @param mediaItems - Array of media items to process.
         */
        /**
         * Clear descriptions from multiple media items.
         *
         * Processes one item at a time, setting descriptions to empty string.
         * Items that have no description are skipped.
         *
         * @param mediaItems - Array of media items to process.
         */
        async clearDescriptions(mediaItems) {
            log(`Clear Descriptions: Processing ${mediaItems.length} items`);
            let cleared = 0;
            let skipped = 0;

            for (let i = 0; i < mediaItems.length; i++) {
                if (!this.core.isProcessRunning) break;

                try {
                    const item = mediaItems[i];
                    const itemInfoExt = await this.api.getItemInfoExt(item.mediaKey);
                    if (!itemInfoExt.descriptionFull) {
                        skipped++;
                        continue;
                    }
                    log(`Clear Descriptions [${i + 1}/${mediaItems.length}]: Removing description...`);
                    await this.api.setItemDescription(item.dedupKey, '');
                    cleared++;
                } catch (error) {
                    log(`Clear Descriptions [${i + 1}/${mediaItems.length}] error: ${String(error)}`, 'error');
                    skipped++;
                }
            }

            log(`Clear Descriptions: Cleared ${cleared}, skipped ${skipped} (no description or error)`);
        }
        async aiDescribeItems(mediaItems) {
            const settings = getFromStorage('apiSettings');
            const provider = settings?.aiProvider ?? apiSettingsDefault.aiProvider;
            const delaySetting = provider === 'ollama'
                ? settings?.ollamaDelayMs ?? apiSettingsDefault.ollamaDelayMs
                : settings?.geminiDelayMs ?? apiSettingsDefault.geminiDelayMs;
            const delayMs = parseInt(String(delaySetting), 10) || 0;
            log(`AI Describe: Processing up to ${mediaItems.length} items with ${provider} (delay: ${delayMs}ms between calls)`);
            
            let described = 0;
            let skipped = 0;
            
            // Loop sequentially to ensure reliable API pacing and accurate progress logging
            for (let i = 0; i < mediaItems.length; i++) {
                if (!this.core.isProcessRunning) break;
                
                try {
                    const [result] = await this.aiDescribeOneItem([mediaItems[i]], i + 1, mediaItems.length);
                    if (result) {
                        described++;
                    } else {
                        skipped++;
                    }
                } catch (error) {
                    skipped++;
                }
            }
            
            log(`AI Describe: Set ${described} descriptions, skipped ${skipped} (already described or error)`);
        }
        /**
         * Set the date/time of media items based on dates parsed from their filenames.
         * Uses exiftool-style date parsing algorithm:
         * - Looks for 4 consecutive digits as year (YYYY)
         * - Followed by 2 digits each for month, day, hour, minute, second
         * - Separator-agnostic (works with -, _, /, or no separator)
         *
         * Useful for screenshots or bulk-uploaded photos that have the date
         * in the filename but not in the embedded EXIF metadata.
         *
         * @param mediaItems - Array of media items to process.
         *
         * @example
         * // Supported filename formats:
         * // IMG_20230515_143022.jpg → 2023-05-15 14:30:22
         * // Screenshot_2023-05-15-14-30-22.png → 2023-05-15 14:30:22
         * // photo_20230515.jpg → 2023-05-15 00:00:00
         * // 2023_05_15_photo.jpg → 2023-05-15 00:00:00
         */
        async setTimestampFromFilename(mediaItems) {
            log(`Processing ${mediaItems.length} items to set dates from filenames`);
            // Fetch filenames and timezone offsets in bulk
            const mediaInfoData = await this.getBatchMediaInfoChunked(mediaItems);
            // Create a map for quick lookup
            const infoByKey = new Map(mediaInfoData.map((info) => [info.mediaKey, info]));
            // Merge bulk info into media items
            const itemsWithInfo = mediaItems.map((item) => {
                const info = infoByKey.get(item.mediaKey);
                return {
                    ...item,
                    fileName: info?.fileName,
                    timezoneOffset: info?.timezoneOffset ?? item.timezoneOffset,
                };
            });
            // Build list of items with parseable dates
            const itemsToUpdate = [];
            for (const item of itemsWithInfo) {
                if (!item.fileName)
                    continue;
                const parsedDate = parseDateFromFilename(item.fileName);
                if (!parsedDate)
                    continue;
                // Convert timestamp from milliseconds to seconds
                const timestampSec = Math.floor(parsedDate.timestamp / 1000);
                // Convert timezone offset from milliseconds to seconds (or default to 0)
                const timezoneSec = item.timezoneOffset
                    ? Math.floor(item.timezoneOffset / 1000)
                    : 0;
                itemsToUpdate.push({
                    dedupKey: item.dedupKey,
                    timestampSec,
                    timezoneSec,
                    fileName: item.fileName,
                    formattedDate: formatParsedDate(parsedDate),
                });
            }
            if (itemsToUpdate.length === 0) {
                log('No items with parseable dates in filenames');
                return;
            }
            log(`Found ${itemsToUpdate.length} items with parseable dates in filenames`);
            // Process in chunks using the bulk API
            const chunks = splitArrayIntoChunks(itemsToUpdate, this.operationSize);
            let successCount = 0;
            for (const chunk of chunks) {
                if (!this.core.isProcessRunning)
                    break;
                try {
                    await this.api.setItemsTimestamp(chunk);
                    successCount += chunk.length;
                    // Log each item that was updated
                    for (const item of chunk) {
                        log(`Set date for "${item.fileName}" to ${item.formattedDate}`);
                    }
                }
                catch (error) {
                    console.error('Error setting timestamps for chunk:', error);
                    throw error;
                }
            }
            log(`Successfully set dates for ${successCount} of ${itemsToUpdate.length} items`);
        }
    }
    ApiUtils.ALBUM_ITEM_LIMIT = 20_000;

    /**
     * Helper to wrap filter logic with logging.
     */
    function _wrapFilter(name, mediaItems, filterFn) {
        log(`Filtering by ${name}`);
        const result = filterFn(mediaItems);
        log(`Item count after filtering: ${result.length}`);
        return result;
    }

    function fileNameFilter(mediaItems, filter) {
        const regex = new RegExp(filter.fileNameRegex ?? '');
        return _wrapFilter('filename', mediaItems, (items) => {
            if (filter.fileNameMatchType === 'include')
                return items.filter((item) => regex.test(item.fileName ?? ''));
            if (filter.fileNameMatchType === 'exclude')
                return items.filter((item) => !regex.test(item.fileName ?? ''));
            return items;
        });
    }
    function searchQueryFilter(mediaItems, filter) {
        if (!filter.searchQuery?.trim())
            return mediaItems;
        const query = filter.searchQuery.toLowerCase();
        return _wrapFilter('search query', mediaItems, (items) =>
            items.filter((item) => {
                const fileName = (item.fileName ?? '').toLowerCase();
                const description = (item.description ?? '').toLowerCase();
                return fileName.includes(query) || description.includes(query);
            })
        );
    }
    function descriptionFilter(mediaItems, filter) {
        const regex = new RegExp(filter.descriptionRegex ?? '');
        return _wrapFilter('description', mediaItems, (items) => {
            if (filter.descriptionMatchType === 'include')
                return items.filter((item) => regex.test(item.descriptionFull ?? ''));
            if (filter.descriptionMatchType === 'exclude')
                return items.filter((item) => !regex.test(item.descriptionFull ?? ''));
            return items;
        });
    }
    function descriptionStatusFilter(mediaItems, filter) {
        return _wrapFilter('description status', mediaItems, (items) => {
            if (filter.descriptionStatus === 'has')
                return items.filter((item) => !!String(item.descriptionFull ?? '').trim());
            if (filter.descriptionStatus === 'missing')
                return items.filter((item) => !String(item.descriptionFull ?? '').trim());
            return items;
        });
    }
    function sizeFilter(mediaItems, filter) {
        const high = parseInt(filter.higherBoundarySize ?? '0');
        const low = parseInt(filter.lowerBoundarySize ?? '0');
        return _wrapFilter('size', mediaItems, (items) => {
            let result = items;
            if (high > 0)
                result = result.filter((item) => (item.size ?? 0) < high);
            if (low > 0)
                result = result.filter((item) => (item.size ?? 0) > low);
            return result;
        });
    }
    function resolutionFilter(mediaItems, filter) {
        const minW = parseInt(filter.minWidth ?? '0');
        const maxW = parseInt(filter.maxWidth ?? '0');
        const minH = parseInt(filter.minHeight ?? '0');
        const maxH = parseInt(filter.maxHeight ?? '0');
        return _wrapFilter('resolution', mediaItems, (items) => {
            let result = items;
            if (minW > 0)
                result = result.filter((item) => (item.resWidth ?? 0) >= minW);
            if (maxW > 0)
                result = result.filter((item) => (item.resWidth ?? 0) <= maxW);
            if (minH > 0)
                result = result.filter((item) => (item.resHeight ?? 0) >= minH);
            if (maxH > 0)
                result = result.filter((item) => (item.resHeight ?? 0) <= maxH);
            return result;
        });
    }
    function qualityFilter(mediaItems, filter) {
        return _wrapFilter('quality', mediaItems, (items) => {
            if (filter.quality === 'original')
                return items.filter((item) => item.isOriginalQuality);
            if (filter.quality === 'storage-saver')
                return items.filter((item) => !item.isOriginalQuality);
            return items;
        });
    }
    function spaceFilter(mediaItems, filter) {
        return _wrapFilter('space', mediaItems, (items) => {
            if (filter.space === 'consuming')
                return items.filter((item) => item.takesUpSpace);
            if (filter.space === 'non-consuming')
                return items.filter((item) => !item.takesUpSpace);
            return items;
        });
    }
    function filterByDate(mediaItems, filter) {
        const lower = new Date(filter.lowerBoundaryDate ?? '').getTime();
        const higher = new Date(filter.higherBoundaryDate ?? '').getTime();
        const start = isNaN(lower) ? -Infinity : lower;
        const end = isNaN(higher) ? Infinity : higher;
        return _wrapFilter('date', mediaItems, (items) => {
            if (filter.intervalType === 'include') {
                if (filter.dateType === 'taken')
                    return items.filter((i) => i.timestamp >= start && i.timestamp <= end);
                if (filter.dateType === 'uploaded')
                    return items.filter((i) => i.creationTimestamp >= start && i.creationTimestamp <= end);
            }
            if (filter.intervalType === 'exclude') {
                if (filter.dateType === 'taken')
                    return items.filter((i) => i.timestamp < start || i.timestamp > end);
                if (filter.dateType === 'uploaded')
                    return items.filter((i) => i.creationTimestamp < start || i.creationTimestamp > end);
            }
            return items;
        });
    }
    function filterByMediaType(mediaItems, filter) {
        return _wrapFilter('media type', mediaItems, (items) => {
            if (filter.type === 'video')
                return items.filter((item) => item.duration);
            if (filter.type === 'image')
                return items.filter((item) => !item.duration);
            if (filter.type === 'live')
                return items.filter((item) => item.isLivePhoto);
            return items;
        });
    }
    function filterFavorite(mediaItems, filter) {
        return _wrapFilter('favorites', mediaItems, (items) => {
            if (filter.favorite === 'true')
                return items.filter((item) => item.isFavorite !== false);
            if (filter.favorite === 'false' || filter.excludeFavorites)
                return items.filter((item) => item.isFavorite !== true);
            return items;
        });
    }
    // Coordinates from Google's API are in microdegrees (×10⁷).
    // Convert to decimal degrees for comparison.
    function toDecimalDegrees(microDeg) {
        // Values > 360 or < -360 are clearly microdegrees
        return Math.abs(microDeg) > 360 ? microDeg / 1e7 : microDeg;
    }
    function filterByLocation(mediaItems, filter) {
        const south = parseFloat(filter.boundSouth ?? '');
        const west = parseFloat(filter.boundWest ?? '');
        const north = parseFloat(filter.boundNorth ?? '');
        const east = parseFloat(filter.boundEast ?? '');
        const hasBounds = !isNaN(south) && !isNaN(west) && !isNaN(north) && !isNaN(east);
        return _wrapFilter('location', mediaItems, (items) => {
            let result = items;
            if (filter.hasLocation === 'true')
                result = result.filter((item) => item.geoLocation?.coordinates?.length);
            else if (filter.hasLocation === 'false')
                result = result.filter((item) => !item.geoLocation?.coordinates?.length);
            if (hasBounds) {
                result = result.filter((item) => {
                    const coords = item.geoLocation?.coordinates;
                    if (!coords?.length)
                        return false;
                    const lat = toDecimalDegrees(coords[0]);
                    const lng = toDecimalDegrees(coords[1]);
                    if (lat < south || lat > north)
                        return false;
                    return west <= east ? lng >= west && lng <= east : lng >= west || lng <= east;
                });
            }
            return result;
        });
    }
    function filterOwned(mediaItems, filter) {
        return _wrapFilter('owned', mediaItems, (items) => {
            if (filter.owned === 'true')
                return items.filter((item) => item.isOwned !== false);
            if (filter.owned === 'false')
                return items.filter((item) => item.isOwned !== true);
            return items;
        });
    }
    function filterByUploadStatus(mediaItems, filter) {
        return _wrapFilter('upload status', mediaItems, (items) => {
            if (filter.uploadStatus === 'full')
                return items.filter((item) => item.isPartialUpload === false);
            if (filter.uploadStatus === 'partial')
                return items.filter((item) => item.isPartialUpload === true);
            return items;
        });
    }
    function filterArchived(mediaItems, filter) {
        return _wrapFilter('archived', mediaItems, (items) => {
            if (filter.archived === 'true')
                return items.filter((item) => item.isArchived !== false);
            if (filter.archived === 'false')
                return items.filter((item) => item.isArchived !== true);
            return items;
        });
    }
    // Process images in batches with yield points
    async function processBatch(items, processFn, batchSize = 5, core) {
        const results = [];
        for (let i = 0; i < items.length; i += batchSize) {
            if (!core.isProcessRunning)
                return results;
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map((item) => {
                if (!core.isProcessRunning)
                    return Promise.resolve(null);
                return processFn(item);
            }));
            for (const r of batchResults) {
                if (r !== null)
                    results.push(r);
            }
            // Yield to UI thread after each batch
            await defer(() => { });
        }
        return results;
    }
    // This being a userscript prevents it from using web workers
    // dHash implementation with non-blocking behavior
    async function generateImageHash(hashSize, blob, core) {
        if (!blob)
            return null;
        if (!core.isProcessRunning)
            return null;
        // Load image
        const img = new Image();
        const url = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = url;
        });
        if (!core.isProcessRunning) {
            URL.revokeObjectURL(url);
            return null;
        }
        // Yield to UI thread after image loads
        await defer(() => { });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return null;
        canvas.width = hashSize + 1;
        canvas.height = hashSize;
        // Draw the image scaled down
        ctx.drawImage(img, 0, 0, hashSize + 1, hashSize);
        URL.revokeObjectURL(url);
        if (!core.isProcessRunning)
            return null;
        // Get pixel data
        const imageData = ctx.getImageData(0, 0, hashSize + 1, hashSize);
        const pixels = imageData.data;
        // Yield to UI thread before processing pixels
        return await defer(() => {
            // Calculate the hash using differences between adjacent pixels
            let hash = 0n;
            for (let y = 0; y < hashSize; y++) {
                for (let x = 0; x < hashSize; x++) {
                    // Position in the pixel array
                    const pos = (y * (hashSize + 1) + x) * 4;
                    const nextPos = (y * (hashSize + 1) + x + 1) * 4;
                    // Convert to grayscale using ITU-R BT.601 luminance weights
                    const gray1 = 0.299 * pixels[pos] + 0.587 * pixels[pos + 1] + 0.114 * pixels[pos + 2];
                    const gray2 = 0.299 * pixels[nextPos] + 0.587 * pixels[nextPos + 1] + 0.114 * pixels[nextPos + 2];
                    // Set bit if left pixel is brighter than right pixel
                    if (gray1 > gray2) {
                        hash |= 1n << BigInt(y * hashSize + x);
                    }
                }
            }
            return hash;
        });
    }
    function hammingDistance(hash1, hash2) {
        if (hash1 === null || hash2 === null)
            return Infinity;
        let xor = hash1 ^ hash2;
        let distance = 0;
        while (xor !== 0n) {
            distance += Number(xor & 1n);
            xor >>= 1n;
        }
        return distance;
    }
    async function groupSimilarImages(imageHashes, similarityThreshold, hashSize = 8, core) {
        const groups = [];
        // Process in small batches to prevent UI blocking
        const batchSize = 10;
        for (let i = 0; i < imageHashes.length; i += batchSize) {
            const batch = imageHashes.slice(i, i + batchSize);
            for (const image of batch) {
                let addedToGroup = false;
                for (const group of groups) {
                    if (!core.isProcessRunning)
                        return groups;
                    const groupHash = group[0].hash;
                    const distance = hammingDistance(image.hash, groupHash);
                    // Max distance for a 8x8 hash is 64
                    const maxPossibleDistance = hashSize * hashSize;
                    const similarity = 1 - distance / maxPossibleDistance;
                    if (similarity >= similarityThreshold) {
                        group.push(image);
                        addedToGroup = true;
                        break;
                    }
                }
                if (!addedToGroup) {
                    groups.push([image]);
                }
            }
            // Yield to UI thread after each batch
            await defer(() => { });
        }
        return groups.filter((group) => group.length > 1);
    }
    // Fetch image blobs with concurrency control
    async function fetchImageBlobs(mediaItems, maxConcurrency, imageHeight, core) {
        const fetchWithLimit = async (item, retries = 3) => {
            for (let attempt = 1; attempt <= retries; attempt++) {
                if (!core.isProcessRunning)
                    return null;
                const url = item.thumb + `=h${imageHeight}`; // Resize image
                try {
                    const response = await fetch(url, {
                        cache: 'force-cache',
                        credentials: 'include',
                        signal: AbortSignal.timeout(10000), // fetch timeout 10s
                    });
                    if (!response.ok)
                        throw new Error(`HTTP ${response.status}`);
                    if (!core.isProcessRunning)
                        return null;
                    const blob = await response.blob();
                    return { ...item, blob };
                }
                catch (error) {
                    const errMsg = error instanceof Error ? error.message : String(error);
                    if (attempt < retries) {
                        log(`Attempt ${attempt} failed for ${item.mediaKey} (${errMsg}). Retrying...`, 'error');
                        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // backoff
                    }
                    else {
                        log(`Failed to fetch thumb ${item.mediaKey} after ${retries} attempts. Final error: ${errMsg}`, 'error');
                        return null;
                    }
                }
            }
            return null;
        };
        const results = [];
        const queue = [...mediaItems];
        // Process the queue with concurrency control
        const worker = async () => {
            while (queue.length > 0) {
                if (!core.isProcessRunning)
                    return;
                const item = queue.shift();
                if (!item)
                    continue;
                const result = await fetchWithLimit(item);
                if (result)
                    results.push(result);
            }
        };
        // Start multiple workers to handle concurrent fetches
        const workers = Array.from({ length: maxConcurrency }, () => worker());
        await Promise.all(workers);
        return results;
    }
    // Calculate an appropriate hash size based on image height
    function calculateHashSize(imageHeight) {
        // Base hash size on the square root of the height
        const baseSize = Math.max(8, Math.floor(Math.sqrt(imageHeight) / 4));
        // Keep hash size reasonable to prevent performance issues
        return Math.min(32, baseSize);
    }
    // Main function to filter similar media items
    async function filterSimilar(core, mediaItems, filter) {
        const maxConcurrentFetches = 50;
        const similarityThreshold = Number(filter.similarityThreshold) || 0.9;
        const imageHeight = Number(filter.imageHeight) || 100;
        const hashSize = calculateHashSize(imageHeight); // Dynamic hash size
        // FIX #82: Skip items that have no thumbnail URL. Expired or missing
        // thumbs cause HTTP 400 errors that abort the entire similarity run.
        const itemsWithThumbs = mediaItems.filter((item) => !!item.thumb);
        const skippedCount = mediaItems.length - itemsWithThumbs.length;
        if (skippedCount > 0) {
            log(`Skipped ${skippedCount} items with no thumbnail`);
        }
        log('Fetching images');
        const itemsWithBlobs = await fetchImageBlobs(itemsWithThumbs, maxConcurrentFetches, imageHeight, core);
        if (!core.isProcessRunning)
            return [];
        log('Generating image hashes');
        // Process images in batches to prevent UI blocking
        const itemsWithHashes = await processBatch(itemsWithBlobs, async (item) => {
            if (!core.isProcessRunning)
                return null;
            const hash = await generateImageHash(hashSize, item.blob, core);
            return hash !== null ? { ...item, hash } : null;
        }, 50, // Process 50 images per batch
            core);
        if (!core.isProcessRunning)
            return [];
        log('Grouping similar images');
        const groups = await groupSimilarImages(itemsWithHashes, similarityThreshold, hashSize, core);
        // Flatten the groups into a single array of items
        const flattenedGroups = groups.flat();
        log(`Found ${flattenedGroups.length} similar items across ${groups.length} groups`);
        return flattenedGroups;
    }

    /**
     * Core orchestration class for the Google Photos Toolkit.
     *
     * Manages the process lifecycle, fetches media from various sources,
     * applies a chain of filters, and dispatches actions.
     *
     * Exposed globally as `gptkCore` for console scripting:
     * ```js
     * gptkCore.isProcessRunning; // check if a process is active
     * ```
     */
    class Core {
        constructor() {
            this.isProcessRunning = false;
            this.api = new Api();
            // Strategy map for actions — avoids sequential if-chain
            this.actionHandlers = {
                unLock: async (p) => this.apiUtils.removeFromLockedFolder(p.mediaItems),
                lock: async (p) => this.apiUtils.moveToLockedFolder(p.mediaItems),
                toExistingAlbum: async (p) => {
                    if (!p.targetAlbum)
                        throw new Error('No target album specified');
                    await this.apiUtils.addToExistingAlbum(p.mediaItems, p.targetAlbum, p.preserveOrder);
                },
                toArchive: async (p) => this.apiUtils.sendToArchive(p.mediaItems),
                unArchive: async (p) => this.apiUtils.unArchive(p.mediaItems),
                toFavorite: async (p) => this.apiUtils.setAsFavorite(p.mediaItems),
                unFavorite: async (p) => this.apiUtils.unFavorite(p.mediaItems),
                copyDescFromOther: async (p) => this.apiUtils.copyDescriptionFromOther(p.mediaItems),
                setDateFromFilename: async (p) => this.apiUtils.setTimestampFromFilename(p.mediaItems),
                aiDescribe: async (p) => this.apiUtils.aiDescribeItems(p.mediaItems),
                clearDescriptions: async (p) => this.apiUtils.clearDescriptions(p.mediaItems),
            };
        }
        /**
         * Fetch media items from the given source and apply all active filters.
         *
         * @param filter - The filter configuration to apply.
         * @param source - The media source to read from.
         * @returns The filtered array of media items.
         */
        async getAndFilterMedia(filter, source) {
            const mediaItems = await this.fetchMediaItems(source, filter);
            log(`Found items: ${mediaItems.length}`);
            if (!this.isProcessRunning || !mediaItems?.length)
                return mediaItems;
            const filteredItems = await this.applyFilters(mediaItems, filter, source);
            return filteredItems;
        }
        /**
         * Fetch raw media items from the specified source (before filtering).
         *
         * @param source - The media source to read from.
         * @param filter - The filter (used for date range and search query parameters).
         * @returns Array of unfiltered media items from the source.
         */
        async fetchMediaItems(source, filter) {
            const sourceHandlers = {
                library: async () => {
                    log('Reading library');
                    return filter.dateType === 'uploaded'
                        ? await this.getLibraryItemsByUploadDate(filter)
                        : await this.getLibraryItemsByTakenDate(filter);
                },
                search: async () => {
                    log('Reading search results');
                    return await this.apiUtils.getAllSearchItems(filter.searchQuery ?? '');
                },
                lockedFolder: async () => {
                    log('Getting locked folder items');
                    return await this.apiUtils.getAllLockedFolderItems();
                },
                favorites: async () => {
                    log('Getting favorite items');
                    return await this.apiUtils.getAllFavoriteItems();
                },
                sharedLinks: async () => {
                    log('Getting shared links');
                    const sharedLinks = await this.apiUtils.getAllSharedLinks();
                    if (!sharedLinks || sharedLinks.length === 0) {
                        log('No shared links found', 'error');
                        return [];
                    }
                    log(`Shared Links Found: ${sharedLinks.length}`);
                    const sharedLinkItems = await Promise.all(sharedLinks.map(async (sharedLink) => {
                        log('Getting shared link items');
                        return await this.apiUtils.getAllMediaInSharedLink(sharedLink.linkId);
                    }));
                    return sharedLinkItems.flat();
                },
                albums: async () => {
                    if (!filter.albumsInclude) {
                        log('No target album!', 'error');
                        throw new Error('no target album');
                    }
                    const albumMediaKeys = Array.isArray(filter.albumsInclude) ? filter.albumsInclude : [filter.albumsInclude];
                    const albumItems = await Promise.all(albumMediaKeys.map(async (albumMediaKey) => {
                        log('Getting album items');
                        return await this.apiUtils.getAllMediaInAlbum(albumMediaKey);
                    }));
                    return albumItems.flat();
                },
            };
            const handler = sourceHandlers[source];
            if (!handler) {
                log(`Unknown source: ${source}`, 'error');
                return [];
            }
            const mediaItems = await handler();
            log('Source read complete');
            return mediaItems;
        }
        /**
         * Apply all active filters to the media items.
         *
         * Filters are applied in a specific order: basic filters first, then
         * extended info filters (which require an additional API call), and
         * finally similarity detection.
         *
         * @param mediaItems - The items to filter.
         * @param filter - The filter configuration.
         * @param source - The media source (affects which filters apply).
         * @returns The filtered array of media items.
         */
        async applyFilters(mediaItems, filter, source) {
            let filteredItems = mediaItems;
            const filtersToApply = [
                {
                    condition: source !== 'library' && Boolean(filter.lowerBoundaryDate ?? filter.higherBoundaryDate),
                    method: () => filterByDate(filteredItems, filter),
                },
                {
                    condition: !!filter.albumsExclude,
                    method: async () => await this.excludeAlbumItems(filteredItems, filter),
                },
                {
                    condition: !!filter.excludeShared,
                    method: async () => await this.excludeSharedItems(filteredItems),
                },
                {
                    condition: !!filter.owned,
                    method: () => filterOwned(filteredItems, filter),
                },
                {
                    condition: Boolean(filter.hasLocation ?? filter.boundSouth ?? filter.boundWest ?? filter.boundNorth ?? filter.boundEast),
                    method: () => filterByLocation(filteredItems, filter),
                },
                {
                    condition: !!filter.uploadStatus,
                    method: () => filterByUploadStatus(filteredItems, filter),
                },
                {
                    condition: !!filter.archived,
                    method: () => filterArchived(filteredItems, filter),
                },
                {
                    condition: Boolean(filter.favorite ?? filter.excludeFavorites),
                    method: () => filterFavorite(filteredItems, filter),
                },
                {
                    condition: !!filter.type,
                    method: () => filterByMediaType(filteredItems, filter),
                },
                {
                    condition: Boolean(filter.minWidth ?? filter.maxWidth ?? filter.minHeight ?? filter.maxHeight),
                    method: () => resolutionFilter(filteredItems, filter),
                },
            ];
            // Apply basic filters
            for (const { condition, method } of filtersToApply) {
                if (condition && filteredItems.length) {
                    filteredItems = await method();
                }
            }
            // Apply filters based on extended media info
            if (filteredItems.length &&
                (filter.space ?? filter.quality ?? filter.lowerBoundarySize ?? filter.higherBoundarySize ?? filter.fileNameRegex ?? filter.descriptionRegex ?? filter.descriptionStatus)) {
                filteredItems = await this.extendMediaItemsWithMediaInfo(filteredItems);
                const extendedFilters = [
                    { condition: !!filter.fileNameRegex, method: () => fileNameFilter(filteredItems, filter) },
                    { condition: !!filter.descriptionRegex, method: () => descriptionFilter(filteredItems, filter) },
                    { condition: !!filter.descriptionStatus, method: () => descriptionStatusFilter(filteredItems, filter) },
                    { condition: (source !== 'search' && !!filter.searchQuery), method: () => searchQueryFilter(filteredItems, filter) },
                    { condition: !!filter.space, method: () => spaceFilter(filteredItems, filter) },
                    { condition: !!filter.quality, method: () => qualityFilter(filteredItems, filter) },
                    {
                        condition: Boolean(filter.lowerBoundarySize ?? filter.higherBoundarySize),
                        method: () => sizeFilter(filteredItems, filter),
                    },
                ];
                for (const { condition, method } of extendedFilters) {
                    if (condition && filteredItems.length) {
                        filteredItems = method();
                    }
                }
            }
            if (filter.sortBySize && filteredItems.length) {
                filteredItems = await this.extendMediaItemsWithMediaInfo(filteredItems);
                filteredItems.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
            }
            // FIX #7: Added missing `await` for filterSimilar (was returning a Promise instead of results)
            if (filteredItems.length > 0 && filter.similarityThreshold) {
                filteredItems = await filterSimilar(this, filteredItems, filter);
            }
            return filteredItems;
        }
        async excludeAlbumItems(mediaItems, filter) {
            const albumMediaKeys = Array.isArray(filter.albumsExclude) ? filter.albumsExclude : [filter.albumsExclude ?? ''];
            const excludedItemArrays = await Promise.all(albumMediaKeys.map(async (albumMediaKey) => {
                log('Getting album items to exclude');
                return await this.apiUtils.getAllMediaInAlbum(albumMediaKey);
            }));
            log('Excluding album items');
            const excludeKeys = new Set(excludedItemArrays.flat().map((item) => item.dedupKey));
            return mediaItems.filter((mediaItem) => !excludeKeys.has(mediaItem.dedupKey));
        }
        async excludeSharedItems(mediaItems) {
            log('Getting shared links items to exclude');
            const sharedLinks = await this.apiUtils.getAllSharedLinks();
            const excludedItemArrays = await Promise.all(sharedLinks.map(async (sharedLink) => {
                return await this.apiUtils.getAllMediaInSharedLink(sharedLink.linkId);
            }));
            log('Excluding shared items');
            const excludeKeys = new Set(excludedItemArrays.flat().map((item) => item.dedupKey));
            return mediaItems.filter((mediaItem) => !excludeKeys.has(mediaItem.dedupKey));
        }
        async extendMediaItemsWithMediaInfo(mediaItems) {
            const mediaInfoData = await this.apiUtils.getBatchMediaInfoChunked(mediaItems);
            const infoByKey = new Map(mediaInfoData.map((info) => [info.mediaKey, info]));
            const extendedMediaItems = mediaItems.map((item) => {
                const matchingInfoItem = infoByKey.get(item.mediaKey);
                return { ...item, ...matchingInfoItem };
            });
            return extendedMediaItems;
        }
        async getLibraryItemsByTakenDate(filter) {
            let source;
            if (filter.archived === 'true') {
                source = 'archive';
            }
            else if (filter.archived === 'false') {
                source = 'library';
            }
            let lowerBoundaryDate = new Date(filter.lowerBoundaryDate ?? '').getTime();
            let higherBoundaryDate = new Date(filter.higherBoundaryDate ?? '').getTime();
            lowerBoundaryDate = isNaN(lowerBoundaryDate) ? -Infinity : lowerBoundaryDate;
            higherBoundaryDate = isNaN(higherBoundaryDate) ? Infinity : higherBoundaryDate;
            const mediaItems = [];
            let nextPageId = null;
            // FIX #1: Fixed operator precedence bug.
            // Before: Number.isInteger(lowerBoundaryDate || Number.isInteger(higherBoundaryDate))
            // The inner Number.isInteger was evaluated first, producing a boolean, which was
            // then OR'd with lowerBoundaryDate and passed to the outer Number.isInteger.
            if ((Number.isInteger(lowerBoundaryDate) || Number.isInteger(higherBoundaryDate)) && filter.intervalType === 'include') {
                let nextPageTimestamp = higherBoundaryDate !== Infinity ? higherBoundaryDate : null;
                do {
                    if (!this.isProcessRunning)
                        return mediaItems;
                    const mediaPage = await this.api.getItemsByTakenDate(nextPageTimestamp, source ?? null, nextPageId);
                    nextPageId = mediaPage?.nextPageId ?? null;
                    if (!mediaPage) {
                        log('Empty page response, skipping', 'error');
                        continue;
                    }
                    nextPageTimestamp = mediaPage.lastItemTimestamp - 1;
                    if (!mediaPage.items || mediaPage.items.length === 0)
                        continue;
                    mediaPage.items = mediaPage.items.filter((item) => item.timestamp >= lowerBoundaryDate && item.timestamp <= higherBoundaryDate);
                    if (!mediaPage.items || mediaPage.items.length === 0)
                        continue;
                    log(`Found ${mediaPage.items.length} items`);
                    mediaItems.push(...mediaPage.items);
                    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- intentional boolean OR
                } while ((nextPageId && !nextPageTimestamp) || (nextPageTimestamp && nextPageTimestamp > lowerBoundaryDate));
            }
            else if ((Number.isInteger(lowerBoundaryDate) || Number.isInteger(higherBoundaryDate)) && filter.intervalType === 'exclude') {
                let nextPageTimestamp = null;
                do {
                    if (!this.isProcessRunning)
                        return mediaItems;
                    const mediaPage = await this.api.getItemsByTakenDate(nextPageTimestamp, source ?? null, nextPageId);
                    nextPageId = mediaPage?.nextPageId ?? null;
                    if (!mediaPage) {
                        log('Empty page response, skipping', 'error');
                        continue;
                    }
                    nextPageTimestamp = mediaPage.lastItemTimestamp - 1;
                    if (!mediaPage.items || mediaPage.items.length === 0)
                        continue;
                    mediaPage.items = mediaPage.items.filter((item) => item.timestamp < lowerBoundaryDate || item.timestamp > higherBoundaryDate);
                    if (nextPageTimestamp > lowerBoundaryDate && nextPageTimestamp < higherBoundaryDate) {
                        nextPageTimestamp = lowerBoundaryDate;
                    }
                    else {
                        nextPageTimestamp = mediaPage.lastItemTimestamp - 1;
                    }
                    if (!mediaPage.items || mediaPage.items.length === 0)
                        continue;
                    log(`Found ${mediaPage.items.length} items`);
                    mediaItems.push(...mediaPage.items);
                } while (nextPageId);
            }
            else {
                let nextPageTimestamp = null;
                do {
                    if (!this.isProcessRunning)
                        return mediaItems;
                    const mediaPage = await this.api.getItemsByTakenDate(nextPageTimestamp, source ?? null, nextPageId);
                    nextPageId = mediaPage?.nextPageId ?? null;
                    if (!mediaPage) {
                        log('Empty page response, skipping', 'error');
                        continue;
                    }
                    nextPageTimestamp = mediaPage.lastItemTimestamp - 1;
                    if (!mediaPage.items || mediaPage.items.length === 0)
                        continue;
                    log(`Found ${mediaPage.items.length} items`);
                    mediaItems.push(...mediaPage.items);
                } while (nextPageId);
            }
            return mediaItems;
        }
        async getLibraryItemsByUploadDate(filter) {
            let lowerBoundaryDate = new Date(filter.lowerBoundaryDate ?? '').getTime();
            let higherBoundaryDate = new Date(filter.higherBoundaryDate ?? '').getTime();
            lowerBoundaryDate = isNaN(lowerBoundaryDate) ? -Infinity : lowerBoundaryDate;
            higherBoundaryDate = isNaN(higherBoundaryDate) ? Infinity : higherBoundaryDate;
            const mediaItems = [];
            let nextPageId = null;
            let skipTheRest = false;
            do {
                if (!this.isProcessRunning)
                    return mediaItems;
                const mediaPage = await this.api.getItemsByUploadedDate(nextPageId);
                nextPageId = mediaPage?.nextPageId ?? null;
                if (!mediaPage) {
                    log('Empty page response, skipping', 'error');
                    continue;
                }
                if (!mediaPage.items || mediaPage.items.length === 0)
                    continue;
                const lastTimeStamp = mediaPage.items[mediaPage.items.length - 1].creationTimestamp;
                let filteredPageItems = mediaPage.items;
                if (filter.intervalType === 'include') {
                    filteredPageItems = mediaPage.items.filter((item) => item.creationTimestamp >= lowerBoundaryDate && item.creationTimestamp <= higherBoundaryDate);
                    skipTheRest = lastTimeStamp < lowerBoundaryDate;
                }
                else if (filter.intervalType === 'exclude') {
                    filteredPageItems = mediaPage.items.filter((item) => item.creationTimestamp < lowerBoundaryDate || item.creationTimestamp > higherBoundaryDate);
                }
                if (!filteredPageItems || filteredPageItems.length === 0)
                    continue;
                log(`Found ${filteredPageItems.length} items`);
                mediaItems.push(...filteredPageItems);
            } while (nextPageId && !skipTheRest);
            return mediaItems;
        }
        preChecks(filter) {
            if (filter.source === 'search' && !filter.searchQuery?.trim()) {
                throw new Error('Search Query Required: Please enter a query in the Search box.');
            }
            if (filter.fileNameRegex) {
                const isValid = isPatternValid(filter.fileNameRegex);
                if (isValid !== true)
                    throw new Error(String(isValid));
            }
            if (filter.descriptionRegex) {
                const isValid = isPatternValid(filter.descriptionRegex);
                if (isValid !== true)
                    throw new Error(String(isValid));
            }
            if (parseInt(filter.lowerBoundarySize ?? '0') >= parseInt(filter.higherBoundarySize ?? '0') &&
                parseInt(filter.lowerBoundarySize ?? '0') > 0 && parseInt(filter.higherBoundarySize ?? '0') > 0) {
                throw new Error('Invalid Size Filter');
            }
            const minW = parseInt(filter.minWidth ?? '0');
            const maxW = parseInt(filter.maxWidth ?? '0');
            if (minW > 0 && maxW > 0 && minW >= maxW) {
                throw new Error('Invalid Resolution Filter: Min Width must be less than Max Width');
            }
            const minH = parseInt(filter.minHeight ?? '0');
            const maxH = parseInt(filter.maxHeight ?? '0');
            if (minH > 0 && maxH > 0 && minH >= maxH) {
                throw new Error('Invalid Resolution Filter: Min Height must be less than Max Height');
            }
            const bS = parseFloat(filter.boundSouth ?? '');
            const bW = parseFloat(filter.boundWest ?? '');
            const bN = parseFloat(filter.boundNorth ?? '');
            const bE = parseFloat(filter.boundEast ?? '');
            const hasSomeBounds = [bS, bW, bN, bE].some((v) => !isNaN(v));
            const hasAllBounds = [bS, bW, bN, bE].every((v) => !isNaN(v));
            if (hasSomeBounds && !hasAllBounds) {
                throw new Error('Bounding Box: All four coordinates (South, West, North, East) are required');
            }
            if (hasAllBounds && bS >= bN) {
                throw new Error('Bounding Box: South latitude must be less than North latitude');
            }
        }
        /**
         * Main entry point: fetch, filter, and execute an action on media items.
         *
         * This is the method called by the UI when the user clicks an action button.
         *
         * @param action - The action to perform (e.g. toTrash, toArchive, toExistingAlbum).
         * @param filter - The filter configuration from the UI form.
         * @param source - The media source to read from.
         * @param targetAlbum - Target album (for "add to existing album" action).
         * @param newTargetAlbumName - New album name (for "add to new album" action).
         * @param apiSettings - Optional API settings overrides (concurrency, batch sizes).
         */
        async actionWithFilter(action, filter, source, targetAlbum, newTargetAlbumName, apiSettings) {
            try {
                this.preChecks(filter);
            }
            catch (error) {
                log(String(error), 'error');
                return;
            }
            this.isProcessRunning = true;
            // Dispatch event to update the UI without importing it
            document.dispatchEvent(new Event('change'));
            this.apiUtils = new ApiUtils(this, apiSettings ?? apiSettingsDefault);
            try {
                const startTime = new Date();
                const mediaItems = await this.getAndFilterMedia(filter, source);
                // Early exit if no items to process
                if (!mediaItems?.length) {
                    log('No items to process');
                    return;
                }
                // Exit if process was stopped externally
                if (!this.isProcessRunning)
                    return;
                // Execute the appropriate action
                await this.executeAction(action, {
                    mediaItems,
                    source,
                    targetAlbum,
                    newTargetAlbumName,
                    preserveOrder: Boolean(filter.similarityThreshold ?? filter.sortBySize),
                });
                log(`Task completed in ${timeToHHMMSS(new Date().getTime() - startTime.getTime())}`, 'success');
            }
            catch (error) {
                log((error instanceof Error ? error.stack : String(error)) ?? 'Unknown error', 'error');
            }
            finally {
                this.isProcessRunning = false;
            }
        }
        async executeAction(action, params) {
            log(`Items to process: ${params.mediaItems.length}`);
            // Use strategy map — also handle special cases for source-based actions
            let actionId = action.elementId;
            if (actionId === 'restoreTrash' || params.source === 'trash')
                actionId = 'restoreTrash';
            if (actionId === 'unLock' || params.source === 'lockedFolder')
                actionId = 'unLock';
            const handler = this.actionHandlers[actionId];
            if (handler) {
                await handler(params);
            }
            else {
                log(`Unknown action: ${actionId}`, 'error');
            }
        }
    }

    const core = new Core();
    const apiUtils = new ApiUtils(core);
    // Exposing API to be accessible globally (fixed typo: was "accesible")
    unsafeWindow.gptkApi = new Api();
    unsafeWindow.gptkCore = core;
    unsafeWindow.gptkApiUtils = apiUtils;

    function updateUI() {
        function toggleVisibility(element, toggle) {
            const allDescendants = element.querySelectorAll('input, select, button, textarea');
            if (toggle) {
                element.style.display = 'block';
                for (const node of allDescendants)
                    node.disabled = false;
            }
            else {
                element.style.display = 'none';
                for (const node of allDescendants)
                    node.disabled = true;
            }
        }
        function filterPreviewUpdate() {
            const previewElement = document.querySelector('.filter-preview span');
            if (!previewElement)
                return;
            try {
                const description = generateFilterDescription(getFormData('.filters-form'));
                previewElement.textContent = description;
            }
            catch {
                previewElement.textContent = 'Failed to generate description';
            }
        }
        function isActiveTab(tabName) {
            const checkedInput = document.querySelector('input[name="source"]:checked');
            return checkedInput?.id === tabName;
        }
        function lockedFolderTabState() {
            const lockedFolderTab = document.getElementById('lockedFolder');
            if (lockedFolderTab && !window.location.href.includes('lockedfolder')) {
                lockedFolderTab.disabled = true;
                if (lockedFolderTab.parentNode instanceof HTMLElement) {
                    lockedFolderTab.parentNode.title = 'To process items in the locked folder, you must open GPTK while in it';
                }
            }
        }
        function updateActionButtonStates() {
            const setDisabled = (id, disabled) => {
                const el = document.getElementById(id);
                if (el)
                    el.disabled = disabled;
            };
            setDisabled('unArchive', archivedExcluded);
            setDisabled('toFavorite', favoritesOnly || isActiveTab('favorites'));
            setDisabled('unFavorite', favoritesExcluded);
            setDisabled('toArchive', archivedOnly);
            setDisabled('restoreTrash', !isActiveTab('trash'));
            setDisabled('toTrash', isActiveTab('trash'));
            setDisabled('lock', isActiveTab('lockedFolder'));
            setDisabled('unLock', !isActiveTab('lockedFolder'));
            setDisabled('copyDescFromOther', isActiveTab('trash'));
            setDisabled('aiDescribe', isActiveTab('trash') || isActiveTab('library'));
            setDisabled('clearDescriptions', isActiveTab('trash') || isActiveTab('library'));
        }
        function updateFilterVisibility() {
            const filterElements = {
                livePhotoType: (document.querySelector('.type input[value=live]'))?.parentNode,
                includeAlbums: document.querySelector('.include-albums'),
                owned: document.querySelector('.owned'),
                location: document.querySelector('.location'),
                search: document.querySelector('.search'),
                favorite: document.querySelector('.favorite'),
                quality: document.querySelector('.quality'),
                size: document.querySelector('.size'),
                resolution: document.querySelector('.resolution'),
                filename: document.querySelector('.filename'),
                description: document.querySelector('.description'),
                space: document.querySelector('.space'),
                excludeAlbums: document.querySelector('.exclude-albums'),
                uploadStatus: document.querySelector('.upload-status'),
                archive: document.querySelector('.archive'),
                excludeShared: document.querySelector('.exclude-shared'),
                excludeFavorite: document.querySelector('.exclude-favorites'),
            };
            // Default: hide all
            Object.values(filterElements).forEach((el) => {
                if (el)
                    toggleVisibility(el, false);
            });
            // Conditions for showing filters based on the active tab
            if (isActiveTab('albums') && filterElements.includeAlbums) {
                toggleVisibility(filterElements.includeAlbums, true);
            }
            if (['library', 'search', 'favorites'].some(isActiveTab)) {
                if (filterElements.owned)
                    toggleVisibility(filterElements.owned, true);
                if (filterElements.uploadStatus)
                    toggleVisibility(filterElements.uploadStatus, true);
                if (filterElements.archive)
                    toggleVisibility(filterElements.archive, true);
            }
            if (isActiveTab('search')) {
                if (filterElements.search)
                    toggleVisibility(filterElements.search, true);
                if (filterElements.favorite)
                    toggleVisibility(filterElements.favorite, true);
            }
            if (!isActiveTab('trash')) {
                if (filterElements.livePhotoType)
                    toggleVisibility(filterElements.livePhotoType, true);
                if (filterElements.quality)
                    toggleVisibility(filterElements.quality, true);
                if (filterElements.size)
                    toggleVisibility(filterElements.size, true);
                if (filterElements.resolution)
                    toggleVisibility(filterElements.resolution, true);
                if (filterElements.location)
                    toggleVisibility(filterElements.location, true);
                if (filterElements.filename)
                    toggleVisibility(filterElements.filename, true);
                if (filterElements.description)
                    toggleVisibility(filterElements.description, true);
                if (filterElements.space)
                    toggleVisibility(filterElements.space, true);
                if (!isActiveTab('lockedFolder') && filterElements.excludeAlbums) {
                    toggleVisibility(filterElements.excludeAlbums, true);
                }
                if (!isActiveTab('sharedLinks') && filterElements.excludeShared) {
                    toggleVisibility(filterElements.excludeShared, true);
                }
            }
            if (isActiveTab('library') && filterElements.excludeFavorite) {
                toggleVisibility(filterElements.excludeFavorite, true);
            }
        }
        lockedFolderTabState();
        const filter = getFormData('.filters-form');
        const favoritesOnly = filter.favorite === 'true';
        const favoritesExcluded = filter.excludeFavorites === 'true' || filter.favorite === 'false';
        const archivedOnly = filter.archived === 'true';
        const archivedExcluded = filter.archived === 'false';
        if (core.isProcessRunning) {
            disableActionBar(true);
            const stopBtn = document.getElementById('stopProcess');
            if (stopBtn)
                stopBtn.style.display = 'block';
        }
        else {
            const stopBtn = document.getElementById('stopProcess');
            if (stopBtn)
                stopBtn.style.display = 'none';
            disableActionBar(false);
            updateActionButtonStates();
        }
        updateFilterVisibility();
        filterPreviewUpdate();
        highlightActiveFilters();
    }
    function hasChangedFromDefault(container) {
        // Text, number, date inputs — compare value to defaultValue
        const textInputs = container.querySelectorAll('input[type="text"], input[type="input"], input[type="number"], input[type="datetime-local"]');
        for (const input of textInputs) {
            if (input.value.trim() !== input.defaultValue.trim())
                return true;
        }
        // Radio buttons — check if checked state differs from defaultChecked
        const radios = container.querySelectorAll('input[type="radio"]');
        for (const radio of radios) {
            if (radio.checked !== radio.defaultChecked)
                return true;
        }
        // Checkboxes — check if checked state differs from defaultChecked
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        for (const checkbox of checkboxes) {
            if (checkbox.checked !== checkbox.defaultChecked)
                return true;
        }
        // Multi-selects — check if selected state differs from defaultSelected
        const selects = container.querySelectorAll('select');
        for (const select of selects) {
            for (const option of select.options) {
                if (option.selected !== option.defaultSelected)
                    return true;
            }
        }
        return false;
    }
    function highlightActiveFilters() {
        const filtersForm = document.querySelector('.filters-form');
        if (!filtersForm)
            return;
        // Details-based filters
        const detailsList = filtersForm.querySelectorAll('details');
        for (const details of detailsList) {
            details.classList.toggle('filter-active', hasChangedFromDefault(details));
        }
        // Standalone checkbox fieldsets (exclude-shared, exclude-favorites, sort-by-size)
        const checkboxFieldsets = filtersForm.querySelectorAll(':scope > fieldset');
        for (const fieldset of checkboxFieldsets) {
            fieldset.classList.toggle('filter-active', hasChangedFromDefault(fieldset));
        }
    }

    const version = "v4.5.0";
    const homepage = "https://github.com/tvcnet/gptk#readme";
    function htmlTemplatePrep(template) {
        return template.replace('%version%', version).replace('%homepage%', homepage);
    }
    function scheduleUiRefresh(delay = 250) {
        clearTimeout(window.__gptkUiRefreshTimer);
        window.__gptkUiRefreshTimer = window.setTimeout(() => {
            insertUi();
        }, delay);
    }
    function removeToolbarTooltip() {
        document.getElementById('gptk-toolbar-tooltip')?.remove();
    }
    function showToolbarTooltip(btnElement) {
        const tooltipText = btnElement?.getAttribute('data-tooltip') || btnElement?.getAttribute('title') || btnElement?.getAttribute('aria-label');
        if (!btnElement || !tooltipText) {
            return;
        }
        removeToolbarTooltip();
        const tooltip = document.createElement('div');
        tooltip.id = 'gptk-toolbar-tooltip';
        tooltip.className = 'gptk-toolbar-tooltip';
        tooltip.textContent = tooltipText;
        document.body.appendChild(tooltip);
        const rect = btnElement.getBoundingClientRect();
        const top = rect.bottom + 8;
        const left = rect.left + rect.width / 2;
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        requestAnimationFrame(() => {
            tooltip.classList.add('is-visible');
        });
    }
    function bindGptkButton(btnElement) {
        if (!btnElement || btnElement.dataset.gptkBound === '1')
            return;
        const openHandler = (e) => {
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') {
                return;
            }
            e.preventDefault();
            if (typeof e.stopImmediatePropagation === 'function') {
                e.stopImmediatePropagation();
            }
            else {
                e.stopPropagation();
            }
            showMainMenu();
        };
        btnElement.addEventListener('mouseenter', () => showToolbarTooltip(btnElement));
        btnElement.addEventListener('focus', () => showToolbarTooltip(btnElement));
        btnElement.addEventListener('mouseleave', removeToolbarTooltip);
        btnElement.addEventListener('blur', removeToolbarTooltip);
        btnElement.addEventListener('click', openHandler, true);
        btnElement.addEventListener('pointerdown', openHandler, true);
        btnElement.addEventListener('mousedown', openHandler, true);
        btnElement.addEventListener('touchstart', openHandler, { capture: true, passive: false });
        btnElement.addEventListener('keydown', openHandler, true);
        btnElement.dataset.gptkBound = '1';
    }
    function normalizeToolbarButtonLayout(btnElement) {
        if (!btnElement)
            return;
        btnElement.style.display = 'inline-flex';
        btnElement.style.alignItems = 'center';
        btnElement.style.justifyContent = 'center';
        btnElement.style.alignSelf = 'center';
        btnElement.style.verticalAlign = 'middle';
        btnElement.style.flex = '0 0 auto';
        btnElement.style.boxSizing = 'border-box';
        btnElement.style.lineHeight = '0';
        btnElement.style.margin = '0';
        btnElement.style.padding = '0';
        btnElement.style.position = 'relative';
        btnElement.style.top = '0';
        btnElement.style.minWidth = '40px';
        btnElement.style.minHeight = '40px';
        btnElement.style.height = '40px';
        btnElement.style.width = '40px';

        const outerSpan = btnElement.querySelector('.MhXXcc.oJeWuf');
        if (outerSpan instanceof HTMLElement) {
            outerSpan.style.display = 'inline-flex';
            outerSpan.style.alignItems = 'center';
            outerSpan.style.justifyContent = 'center';
            outerSpan.style.height = '24px';
            outerSpan.style.width = '24px';
            outerSpan.style.lineHeight = '0';
            outerSpan.style.transform = 'translateY(-7px)';
        }

        const innerSpan = btnElement.querySelector('.Lw7GHd.snByac');
        if (innerSpan instanceof HTMLElement) {
            innerSpan.style.display = 'inline-flex';
            innerSpan.style.alignItems = 'center';
            innerSpan.style.justifyContent = 'center';
            innerSpan.style.height = '24px';
            innerSpan.style.width = '24px';
            innerSpan.style.lineHeight = '0';
        }

        const normalizeDiv = btnElement.querySelector('.oK50pe.eLNT1d');
        if (normalizeDiv instanceof HTMLElement) {
            normalizeDiv.style.display = 'none';
        }

        const svg = btnElement.querySelector('svg');
        if (svg instanceof SVGElement) {
            svg.style.display = 'block';
            svg.style.transform = 'none';
        }
    }
    function normalizeToolbarWrapperLayout(wrapper) {
        if (!(wrapper instanceof HTMLElement))
            return;
        wrapper.className = 'gptk-toolbar-wrapper';
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';
        wrapper.style.alignSelf = 'center';
        wrapper.style.flex = '0 0 40px';
        wrapper.style.width = '40px';
        wrapper.style.minWidth = '40px';
        wrapper.style.maxWidth = '40px';
        wrapper.style.height = '40px';
        wrapper.style.minHeight = '40px';
        wrapper.style.maxHeight = '40px';
        wrapper.style.lineHeight = '0';
        wrapper.style.verticalAlign = 'middle';
        wrapper.style.boxSizing = 'border-box';
        wrapper.style.margin = '0';
        wrapper.style.padding = '0';
        wrapper.style.position = 'relative';
        wrapper.style.top = '0';
        wrapper.style.contain = 'layout style';
    }
    function cleanupToolbarButtonArtifacts() {
        document.querySelectorAll('[data-gptk-wrapper="1"]').forEach((wrapper) => {
            if (!wrapper.querySelector('#gptk-button')) {
                wrapper.remove();
            }
        });
        document.querySelectorAll('[data-gptk-spacer="1"]').forEach((spacer) => spacer.remove());

        const existingButton = document.getElementById('gptk-button');
        if (!(existingButton instanceof HTMLElement)) {
            return;
        }

        const tooltipWrapper = existingButton.closest('span[data-is-tooltip-wrapper="true"]');
        const sharesWrapperWithAnotherButton = !!(tooltipWrapper && tooltipWrapper.querySelectorAll('button').length > 1);
        if (!existingButton.closest('[data-gptk-wrapper="1"]') || sharesWrapperWithAnotherButton) {
            existingButton.remove();
        }
    }
    function insertUi() {
        cleanupToolbarButtonArtifacts();
        let btnElement = document.getElementById('gptk-button');
        const existingWrapper = btnElement?.closest('[data-gptk-wrapper="1"]');
        if (existingWrapper instanceof HTMLElement) {
            normalizeToolbarWrapperLayout(existingWrapper);
        }
        if (!btnElement) {
            // ── 1. Build the GPTK Button 100% via createElement (bypasses Trusted Types) ──
            btnElement = document.createElement('button');
            btnElement.id = 'gptk-button';
            btnElement.type = 'button';
            btnElement.setAttribute('role', 'button');
            btnElement.className = 'U26fgb JRtysb WzwrXb YI2CVc G6iPcb';
            btnElement.setAttribute('aria-label', 'GPTK');
            btnElement.setAttribute('aria-disabled', 'false');
            btnElement.setAttribute('tabindex', '0');
            btnElement.setAttribute('data-tooltip', 'Google Photos Toolkit');
            btnElement.setAttribute('title', 'Google Photos Toolkit');
            btnElement.setAttribute('aria-haspopup', 'true');
            btnElement.setAttribute('aria-expanded', 'false');
            btnElement.style.transition = 'opacity 0.15s ease';
            btnElement.style.cursor = 'pointer';
            btnElement.style.pointerEvents = 'auto';
            btnElement.style.background = 'transparent';
            btnElement.style.border = 'none';
            btnElement.style.outline = 'none';
            btnElement.style.boxShadow = 'none';

            // Ripple layer
            const ripple = document.createElement('div');
            ripple.className = 'NWlf3e MbhUzd';
            btnElement.appendChild(ripple);

            // Icon wrapper
            const outerSpan = document.createElement('span');
            outerSpan.className = 'MhXXcc oJeWuf';
            const innerSpan = document.createElement('span');
            innerSpan.className = 'Lw7GHd snByac';

            // SVG icon (using createElementNS for SVG namespace — fully Trusted Types safe)
            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('width', '24px');
            svg.setAttribute('height', '24px');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.style.fill = '#1a9fff';
            const g = document.createElementNS(svgNS, 'g');
            g.setAttribute('stroke-width', '1');
            g.setAttribute('transform', 'translate(3.0, 3.95)');
            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', 'M6.838,11.784 L12.744,5.879 C13.916,6.484 15.311,6.372 16.207,5.477 C16.897,4.786 17.131,3.795 16.923,2.839 L15.401,4.358 L14.045,4.624 L12.404,2.999 L12.686,1.603 L14.195,0.113 C13.24,-0.095 12.248,0.136 11.557,0.827 C10.661,1.723 10.549,3.117 11.155,4.291 L5.249,10.197 C4.076,9.592 2.681,9.705 1.784,10.599 C1.096,11.29 0.862,12.281 1.069,13.236 L2.592,11.717 L3.947,11.452 L5.59,13.077 L5.306,14.473 L3.797,15.963 C4.752,16.17 5.744,15.94 6.434,15.249 C7.33,14.354 7.443,12.958 6.838,11.784 L6.838,11.784 Z');
            g.appendChild(path);
            svg.appendChild(g);
            innerSpan.appendChild(svg);

            outerSpan.appendChild(innerSpan);
            btnElement.appendChild(outerSpan);

            // ── 2. Identify Anchors (broadened for global availability) ──
            const anchors = [
                'button[aria-label="Order photos"]',
                'button[aria-label*="Add photos"]',
                'button[aria-label*="Create"]',
                'button[aria-label*="create"]',
                'button[aria-label*="Upload"]',
                'button[aria-label*="upload"]',
                'header button[aria-label*="Help"]',
                'header button[aria-label*="Settings"]',
                '[aria-label*="Support"]',
                '[aria-label="Google Account"]',
                'header [data-ogsr-up]',
                '.gb_Td',
                '.c9yG5b'
            ];

            let target = null;
            for (const selector of anchors) {
                try {
                    target = document.querySelector(selector);
                    if (target) {
                        console.log(`GPTK: Anchor found: ${selector}`);
                        break;
                    }
                }
                catch (e) {}
            }

            // ── 3. Inject the button ──
            if (target) {
                const targetWrapper = target.closest('div[jscontroller="ZvHseb"]');
                if (targetWrapper?.parentElement) {
                    const wrapper = document.createElement('div');
                    wrapper.setAttribute('data-gptk-wrapper', '1');
                    normalizeToolbarWrapperLayout(wrapper);

                    const slot = document.createElement('div');
                    slot.setAttribute('jsname', 'WjL7X');
                    slot.setAttribute('jsslot', '');
                    slot.style.display = 'inline-flex';
                    slot.style.alignItems = 'center';
                    slot.style.justifyContent = 'center';
                    slot.style.width = '40px';
                    slot.style.height = '40px';
                    slot.style.lineHeight = '0';

                    const tooltipWrapper = document.createElement('span');
                    tooltipWrapper.setAttribute('data-is-tooltip-wrapper', 'true');
                    tooltipWrapper.style.display = 'inline-flex';
                    tooltipWrapper.style.alignItems = 'center';
                    tooltipWrapper.style.justifyContent = 'center';
                    tooltipWrapper.style.verticalAlign = 'middle';
                    tooltipWrapper.style.width = '40px';
                    tooltipWrapper.style.height = '40px';
                    tooltipWrapper.style.lineHeight = '0';
                    tooltipWrapper.appendChild(btnElement);

                    slot.appendChild(tooltipWrapper);
                    wrapper.appendChild(slot);

                    targetWrapper.insertAdjacentElement('beforebegin', wrapper);
                }
                else {
                    let injectionPoint = target;
                    let el = target;
                    while (el && el.parentElement) {
                        if (el.parentElement.classList.contains('c9yG5b')) {
                            injectionPoint = el;
                            break;
                        }
                        el = el.parentElement;
                    }
                    injectionPoint.insertAdjacentElement('beforebegin', btnElement);
                }
                console.log('GPTK: ✅ Toolbar button injected');
            }
            else {
                // FALLBACK: Floating Action Button (FAB)
                console.warn('GPTK: ⚠️ Deploying FAB');
                btnElement.style.position = 'fixed';
                btnElement.style.bottom = '24px';
                btnElement.style.right = '24px';
                btnElement.style.zIndex = '10000';
                btnElement.style.width = '56px';
                btnElement.style.height = '56px';
                btnElement.style.display = 'flex';
                btnElement.style.alignItems = 'center';
                btnElement.style.justifyContent = 'center';
                btnElement.style.borderRadius = '50%';
                btnElement.style.background = 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)';
                btnElement.style.boxShadow = '0 6px 24px rgba(14,165,233,0.45), 0 2px 8px rgba(0,0,0,0.3)';
                btnElement.style.cursor = 'pointer';
                svg.style.fill = '#ffffff';
                svg.setAttribute('width', '28px');
                svg.setAttribute('height', '28px');
                document.body.appendChild(btnElement);
            }
        }
        normalizeToolbarButtonLayout(btnElement);
        bindGptkButton(btnElement);

        // ── 4. Inject Main Window ──
        if (!document.getElementById('gptk')) {
            try {
                const preparedHtml = htmlTemplatePrep(gptkMainTemplate);
                let htmlToInject = preparedHtml;
                if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
                    try {
                        const existingPolicy = typeof trustedTypes.getPolicy === 'function'
                            ? trustedTypes.getPolicy('gptk#html')
                            : null;
                        const gptkPolicy = existingPolicy ||
                            trustedTypes.createPolicy('gptk#html', { createHTML: (s) => s });
                        htmlToInject = gptkPolicy.createHTML(preparedHtml);
                    } catch (e) { console.warn('GPTK: TT policy failed', e); }
                }

                const container = document.createElement('div');
                container.innerHTML = htmlToInject;
                while (container.firstElementChild) {
                    document.body.insertAdjacentElement('afterbegin', container.firstElementChild);
                }

                actionsListenersSetUp();
                filterListenersSetUp();
                controlButtonsListeners();
                albumSelectsControlsSetUp();
                advancedSettingsListenersSetUp();
                updateUI();

                const cachedAlbums = getFromStorage('albums');
                if (cachedAlbums) addAlbums(cachedAlbums);
            } catch (e) { console.error('GPTK: Injection failed', e); }
        }
        if (!document.getElementById('gptk-styles')) {
            const style = document.createElement('style');
            style.id = 'gptk-styles';
            style.textContent = css;
            document.head.appendChild(style);
        }
        baseListenersSetUp();
    }

    function initDurableUi() {
        insertUi();
        let lastUrl = location.href;
        setInterval(() => {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                document.querySelector('[data-gptk-wrapper="1"]')?.remove();
                document.querySelector('[data-gptk-spacer="1"]')?.remove();
                document.getElementById('gptk-button')?.remove();
                setTimeout(insertUi, 800);
            } else if (!document.getElementById('gptk-button')) {
                insertUi();
            }
        }, 2000);
    }
    function setupMutationObserver() {
        if (window.__gptkMutationObserver)
            return;
        const root = document.body || document.documentElement;
        if (!root)
            return;
        const observer = new MutationObserver(() => {
            if (!document.getElementById('gptk-button') || !document.getElementById('gptk')) {
                scheduleUiRefresh(200);
            }
        });
        observer.observe(root, { childList: true, subtree: true });
        window.__gptkMutationObserver = observer;
    }
    function attachNavListeners() {
        if (window.__gptkNavListenersAttached)
            return;
        const queueRefresh = () => scheduleUiRefresh(350);
        window.addEventListener('popstate', queueRefresh);
        window.addEventListener('hashchange', queueRefresh);
        for (const method of ['pushState', 'replaceState']) {
            const original = history[method];
            if (typeof original !== 'function')
                continue;
            history[method] = function (...args) {
                const result = original.apply(this, args);
                queueRefresh();
                return result;
            };
        }
        window.__gptkNavListenersAttached = true;
    }
    function showMainMenu() {
        const overlay = document.querySelector('.overlay');
        const gptk = document.getElementById('gptk');
        const button = document.getElementById('gptk-button');
        if (gptk)
            gptk.style.display = 'flex';
        if (overlay)
            overlay.style.display = 'block';
        button?.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }
    function hideMainMenu() {
        const overlay = document.querySelector('.overlay');
        const gptk = document.getElementById('gptk');
        const button = document.getElementById('gptk-button');
        if (gptk)
            gptk.style.display = 'none';
        if (overlay)
            overlay.style.display = 'none';
        button?.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = 'visible';
    }
    function baseListenersSetUp() {
        if (window.__gptkBaseListenersSetup)
            return;
        document.addEventListener('change', updateUI);
        bindGptkButton(document.getElementById('gptk-button'));
        const exitMenuButton = document.querySelector('#hide');
        exitMenuButton?.addEventListener('click', hideMainMenu);
        window.__gptkBaseListenersSetup = true;
    }

    function getFromStorage(key) {
        // Preference 1: Extension-level settings (synced via bridge)
        if (key === 'apiSettings' && extSettingsReady) {
            return extSettings;
        }

        // Preference 2: Per-account localStorage
        if (typeof Storage !== 'undefined') {
            const userStorage = JSON.parse(localStorage.getItem(windowGlobalData.account) ?? '{}');
            const storedData = userStorage[key];
            if (storedData !== undefined && storedData !== null) {
                return storedData;
            }
            return null;
        }
        return null;
    }

    function addAlbums(albums) {
        function addAlbumsAsOptions(albums, albumSelects, addEmpty = false) {
            for (const albumSelect of albumSelects) {
                if (!albums?.length) {
                    const option = document.createElement('option');
                    option.textContent = 'No Albums';
                    option.value = '';
                    albumSelect.appendChild(option);
                    continue;
                }
                for (const album of albums) {
                    if (parseInt(String(album.itemCount ?? 0)) === 0 && !addEmpty)
                        continue;
                    const option = document.createElement('option');
                    option.value = album.mediaKey;
                    option.title = `Name: ${album.title}\nItems: ${album.itemCount}`;
                    option.textContent = album.title ?? '';
                    if (album.isShared)
                        option.classList.add('shared');
                    albumSelect.appendChild(option);
                }
            }
        }
        function emptySelects(albumSelects) {
            for (const albumSelect of albumSelects) {
                while (albumSelect.options.length > 0) {
                    albumSelect.remove(0);
                }
            }
            updateUI();
        }
        const albumSelectsMultiple = document.querySelectorAll('.albums-select[multiple]');
        const albumSelectsSingle = document.querySelectorAll('.dropdown.albums-select');
        const albumSelects = [...albumSelectsMultiple, ...albumSelectsSingle];
        emptySelects(albumSelects);
        for (const select of albumSelectsSingle) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Select Album';
            select.appendChild(option);
        }
        addAlbumsAsOptions(albums, Array.from(albumSelectsSingle), true);
        addAlbumsAsOptions(albums, Array.from(albumSelectsMultiple), false);
        if (autoSelectCurrentAlbum()) {
            const includeDetails = document.querySelector('.include-albums');
            if (includeDetails instanceof HTMLDetailsElement) {
                includeDetails.open = true;
            }
        }
        updateUI();
    }

    const actions = [
        { elementId: 'toExistingAlbum', targetId: 'existingAlbum' },
        { elementId: 'toTrash' },
        { elementId: 'restoreTrash' },
        { elementId: 'toArchive' },
        { elementId: 'unArchive' },
        { elementId: 'toFavorite' },
        { elementId: 'unFavorite' },
        { elementId: 'lock' },
        { elementId: 'unLock' },
        { elementId: 'copyDescFromOther' },
        { elementId: 'setDateFromFilename' },
        { elementId: 'aiDescribe' },
        { elementId: 'clearDescriptions' },
    ];
    // Actions that modify data irreversibly and require an extra warning
    const destructiveActions = {
        setDateFromFilename: 'WARNING: This will overwrite the original photo dates. This action cannot be undone!',
        clearDescriptions: 'WARNING: This will permanently remove all descriptions from the filtered photos. This action cannot be undone!',
    };
    function userConfirmation(action, filter) {
        function generateWarning(action, filter) {
            const filterDescription = generateFilterDescription(filter);
            const sourceLabel = document.querySelector('input[name="source"]:checked+label');
            const sourceHuman = sourceLabel?.textContent?.trim() ?? 'Unknown';
            const actionElement = document.getElementById(action.elementId);
            const warning = [];
            warning.push(`Account: ${windowGlobalData.account}`);
            warning.push(`\nSource: ${sourceHuman}`);
            if (sourceHuman === 'Albums' && filter.albumsInclude) {
                const albumNames = getSelectedAlbumNames(filter.albumsInclude);
                if (albumNames.length > 0) {
                    warning.push(`\n${albumNames.length === 1 ? 'Album' : 'Albums'}: ${albumNames.join(', ')}`);
                }
            }
            warning.push(`\n${filterDescription}`);
            warning.push(`\nAction: ${actionElement?.title ?? action.elementId}`);
            // Add extra warning for destructive actions
            const destructiveWarning = destructiveActions[action.elementId];
            if (destructiveWarning) {
                warning.push(`\n\n${destructiveWarning}`);
            }
            return { text: warning.join(' '), isDestructive: !!destructiveWarning };
        }
        const { text: warningText, isDestructive } = generateWarning(action, filter);
        // Chrome suppresses native window.confirm() in extension-injected MAIN-world scripts,
        // causing the dialog to flash and auto-dismiss. Use a custom in-panel modal instead.
        // NOTE: Google Photos enforces Trusted Types CSP — innerHTML is blocked, so we must
        // build the entire DOM tree via createElement to avoid a silent failure.
        return new Promise((resolve) => {
            const panel = document.getElementById('gptk');
            if (!panel) { resolve(false); return; }
            // ── Backdrop ──────────────────────────────────────────────────────
            const backdrop = document.createElement('div');
            backdrop.className = 'gptk-confirm-backdrop';
            // ── Dialog box ────────────────────────────────────────────────────
            const box = document.createElement('div');
            box.className = 'gptk-confirm-box';
            // Title
            const title = document.createElement('div');
            title.className = 'gptk-confirm-title';
            title.textContent = 'Confirm Action';
            // Body — build line by line to highlight WARNING lines
            const body = document.createElement('div');
            body.className = 'gptk-confirm-body';
            const lines = (warningText + '\n\nProceed?').split('\n');
            lines.forEach((line, i) => {
                if (i > 0) body.appendChild(document.createTextNode('\n'));
                if (line.trim().startsWith('WARNING:')) {
                    const span = document.createElement('span');
                    span.className = 'confirm-warning';
                    span.textContent = line;
                    body.appendChild(span);
                } else {
                    body.appendChild(document.createTextNode(line));
                }
            });
            // Action buttons row
            const actions = document.createElement('div');
            actions.className = 'gptk-confirm-actions';
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.textContent = 'Cancel';
            const okBtn = document.createElement('button');
            okBtn.type = 'button';
            okBtn.className = 'btn-primary';
            okBtn.textContent = 'OK';
            actions.appendChild(cancelBtn);
            actions.appendChild(okBtn);
            // Assemble
            box.appendChild(title);
            box.appendChild(body);
            box.appendChild(actions);
            backdrop.appendChild(box);
            panel.appendChild(backdrop);
            // Focus OK for keyboard accessibility
            okBtn.focus();
            function cleanup(result) {
                backdrop.removeEventListener('keydown', onKey);
                if (panel.contains(backdrop)) panel.removeChild(backdrop);
                resolve(result);
            }
            function onKey(e) {
                if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
                if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
            }
            okBtn.addEventListener('click', () => cleanup(true));
            cancelBtn.addEventListener('click', () => cleanup(false));
            backdrop.addEventListener('keydown', onKey);
            // Clicking the backdrop outside the box cancels
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) cleanup(false);
            });
        });
    }
    async function runAction(actionId) {
        const action = actions.find((a) => a.elementId === actionId);
        if (!action)
            return;
        // Get the target album if action has one
        let targetAlbum;
        let newTargetAlbumName;
        if (actionId === 'toExistingAlbum') {
            const albumSelect = document.getElementById(action.targetId ?? '');
            const albumMediaKey = albumSelect?.value;
            const albums = getFromStorage('albums');
            targetAlbum = albums?.find((album) => album.mediaKey === albumMediaKey);
        }
        else {
            const nameInput = document.getElementById(action.targetId ?? '');
            newTargetAlbumName = nameInput?.value;
        }
        // ID of currently selected source element
        const sourceInput = document.querySelector('input[name="source"]:checked');
        const source = (sourceInput?.id ?? 'library');
        // Check filter validity
        const filtersForm = document.querySelector('.filters-form');
        if (filtersForm && !filtersForm.checkValidity()) {
            filtersForm.reportValidity();
            return;
        }
        // Parsed filter object
        const filter = getFormData('.filters-form');
        // Parsed settings object
        const apiSettings = normalizeExtensionSettings({
            ...(getFromStorage('apiSettings') ?? {}),
            ...getFormData('.settings-form', { includeEmpty: true }),
        });

        if (filter.albumOnlyDedupe === 'true') {
            if (source !== 'albums') {
                log('Album-only dedupe requires Source to be set to Albums.', 'error');
                return;
            }
            if (!filter.albumsInclude) {
                log('Album-only dedupe requires a target album selection.', 'error');
                return;
            }
            if (!filter.similarityThreshold) {
                filter.similarityThreshold = '0.95';
            }
        }

        // Safety: selected albums only constrain scope when Albums is the active source.
        // Refuse destructive actions if albums were selected while another source remains active.
        if (filter.albumsInclude && source !== 'albums') {
            const destructiveActionIds = new Set(['toTrash', 'toArchive', 'setDateFromFilename']);
            if (destructiveActionIds.has(actionId)) {
                log('Selected albums only apply when Source is set to Albums. Switch Source to Albums before running this action.', 'error');
                return;
            }
        }

        // SAFETY: Limit AI Descriptions to targeted sources only (Albums, Search, Favorites)
        if ((actionId === 'aiDescribe' || actionId === 'clearDescriptions') && source === 'library') {
            log(`${actionId === 'aiDescribe' ? 'AI Describe' : 'Clear Descriptions'}: Please select specific Albums or perform a Search first. Library-wide processing is disabled to prevent accidental usage.`, 'error');
            return;
        }

        if (!await userConfirmation(action, filter))
            return;
        // Disable action bar while process is running
        disableActionBar(true);
        // Add class to indicate which action is running
        const actionEl = document.getElementById(actionId);
        actionEl?.classList.add('running');
        // Run it
        await core.actionWithFilter(action, filter, source, targetAlbum, newTargetAlbumName, apiSettings);
        // Remove 'running' class
        actionEl?.classList.remove('running');
        // Update the UI
        updateUI();
        // Force show main action bar
        showActionButtons();
    }
    function showExistingAlbumContainer() {
        const actionButtons = document.querySelector('.action-categories');
        const existingContainer = document.querySelector('.to-existing-container');
        if (actionButtons)
            actionButtons.style.display = 'none';
        if (existingContainer)
            existingContainer.style.display = 'flex';
    }
    function showActionButtons() {
        const actionButtons = document.querySelector('.action-categories');
        const existingContainer = document.querySelector('.to-existing-container');
        if (actionButtons)
            actionButtons.style.display = 'flex';
        if (existingContainer)
            existingContainer.style.display = 'none';
    }
    function actionsListenersSetUp() {
        for (const action of actions) {
            const actionElement = document.getElementById(action.elementId);
            if (!actionElement)
                continue;
            if (actionElement.type === 'button') {
                actionElement.addEventListener('click', (event) => {
                    event.preventDefault();
                    void runAction(actionElement.id);
                });
            }
            else if (actionElement.tagName.toLowerCase() === 'form') {
                actionElement.addEventListener('submit', (event) => {
                    event.preventDefault();
                    void runAction(actionElement.id);
                });
            }
        }
        const showExistingAlbumForm = document.querySelector('#showExistingAlbumForm');
        showExistingAlbumForm?.addEventListener('click', showExistingAlbumContainer);
        const returnButtons = document.querySelectorAll('.return');
        for (const button of returnButtons) {
            button?.addEventListener('click', showActionButtons);
        }
    }

    function saveToStorage(key, value) {
        if (typeof Storage !== 'undefined') {
            const userStorage = JSON.parse(localStorage.getItem(windowGlobalData.account) ?? '{}');
            userStorage[key] = value;
            localStorage.setItem(windowGlobalData.account, JSON.stringify(userStorage));
        }
        if (key === 'apiSettings') {
            extSettings = normalizeExtensionSettings(value);
            extSettingsReady = true;
            window.postMessage({ app: 'GPD', action: 'gptkSetStorage', data: extSettings }, '*');
            syncExtensionSettingsToPanel();
        }
    }

    function albumSelectsControlsSetUp() {
        const selectAllButtons = document.querySelectorAll('[name="selectAll"]');
        for (const selectAllButton of selectAllButtons) {
            selectAllButton?.addEventListener('click', selectAllAlbums);
        }
        const selectSharedButtons = document.querySelectorAll('[name="selectShared"]');
        for (const selectSharedButton of selectSharedButtons) {
            selectSharedButton?.addEventListener('click', selectSharedAlbums);
        }
        const selectNotSharedButtons = document.querySelectorAll('[name="selectNonShared"]');
        for (const selectNotSharedButton of selectNotSharedButtons) {
            selectNotSharedButton?.addEventListener('click', selectNotSharedAlbums);
        }
        const resetAlbumSelectionButtons = document.querySelectorAll('[name="resetAlbumSelection"]');
        for (const resetAlbumSelectionButton of resetAlbumSelectionButtons) {
            resetAlbumSelectionButton?.addEventListener('click', resetAlbumSelection);
        }
        const refreshAlbumsButtons = document.querySelectorAll('.refresh-albums');
        for (const refreshAlbumsButton of refreshAlbumsButtons) {
            refreshAlbumsButton?.addEventListener('click', () => void refreshAlbums());
        }
    }
    function selectAllAlbums() {
        const parent = this.parentNode?.parentNode;
        const closestSelect = parent?.querySelector('select');
        if (closestSelect) {
            for (const option of closestSelect.options) {
                if (option.value)
                    option.selected = true;
            }
        }
        updateUI();
    }
    function selectSharedAlbums() {
        const parent = this.parentNode?.parentNode;
        const closestSelect = parent?.querySelector('select');
        if (closestSelect) {
            for (const option of closestSelect.options) {
                if (option.value)
                    option.selected = option.classList.contains('shared');
            }
        }
        updateUI();
    }
    function selectNotSharedAlbums() {
        const parent = this.parentNode?.parentNode;
        const closestSelect = parent?.querySelector('select');
        if (closestSelect) {
            for (const option of closestSelect.options) {
                if (option.value)
                    option.selected = !option.classList.contains('shared');
            }
        }
        updateUI();
    }
    function resetAlbumSelection() {
        const parent = this.parentNode?.parentNode;
        const closestSelect = parent?.querySelector('select');
        if (closestSelect) {
            for (const option of closestSelect.options)
                option.selected = false;
            // Force change event so native browser repaints if needed
            closestSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        updateUI();
    }
    async function refreshAlbums() {
        if (core.isProcessRunning) {
            console.warn("GPTK: Blocking concurrent reload");
            return;
        }
        const buttons = document.querySelectorAll('.refresh-albums');
        buttons.forEach(b => b.classList.add('spinning'));

        // Temporarily set process running to prevent concurrent actions
        core.isProcessRunning = true;
        try {
            const albums = await apiUtils.getAllAlbums();
            addAlbums(albums);
            saveToStorage('albums', albums);
            log('Albums Refreshed');
        }
        catch (e) {
            log(`Error refreshing albums ${String(e)}`, 'error');
            console.error('GPTK: Refresh failed', e);
        }
        core.isProcessRunning = false;
        buttons.forEach(b => b.classList.remove('spinning'));
        updateUI();
    }

    // Fixed typo: was "controlButttonsListeners" (triple-t)
    function controlButtonsListeners() {
        const clearLogButton = document.getElementById('clearLog');
        clearLogButton?.addEventListener('click', clearLog);
        const stopProcessButton = document.getElementById('stopProcess');
        stopProcessButton?.addEventListener('click', stopProcess);
    }
    function clearLog() {
        const logContainer = document.getElementById('logArea');
        if (logContainer) {
            const logElements = Array.from(logContainer.childNodes);
            for (const logElement of logElements) {
                logElement.remove();
            }
        }
    }
    function stopProcess() {
        log('Stopping the process');
        core.isProcessRunning = false;
    }

    function updateAiProviderSettingsVisibility() {
        const providerInput = document.querySelector('select[name="aiProvider"]');
        const provider = providerInput?.value || apiSettingsDefault.aiProvider;
        document.querySelectorAll('[data-ai-provider-section]').forEach((section) => {
            if (!(section instanceof HTMLElement))
                return;
            const isActive = section.getAttribute('data-ai-provider-section') === provider;
            section.style.display = isActive ? 'block' : 'none';
            section.querySelectorAll('input, select, button').forEach((control) => {
                if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLButtonElement) {
                    control.disabled = !isActive;
                }
            });
        });
    }

    function populateOllamaModelOptions(models) {
        const dataList = document.getElementById('ollamaModels');
        if (!dataList)
            return;
        while (dataList.firstChild) {
            dataList.firstChild.remove();
        }
        if (!models || models.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Fetch a model...";
            dataList.appendChild(option);
        } else {
            for (const model of models) {
                if (!model) continue;
                const option = document.createElement('option');
                option.value = String(model);
                option.textContent = String(model);
                dataList.appendChild(option);
            }
        }
    }

    function advancedSettingsListenersSetUp() {
        const maxConcurrentSingleApiReqInput = document.querySelector('input[name="maxConcurrentSingleApiReq"]');
        const maxConcurrentBatchApiReqInput = document.querySelector('input[name="maxConcurrentBatchApiReq"]');
        const operationSizeInput = document.querySelector('input[name="operationSize"]');
        const lockedFolderOpSizeInput = document.querySelector('input[name="lockedFolderOpSize"]');
        const infoSizeInput = document.querySelector('input[name="infoSize"]');
        const aiProviderInput = document.querySelector('select[name="aiProvider"]');
        const geminiDelayMsInput = document.querySelector('input[name="geminiDelayMs"]');
        const ollamaBaseUrlInput = document.querySelector('select[name="ollamaBaseUrl"]');
        const ollamaModelInput = document.querySelector('select[name="ollamaModel"]');
        const ollamaDelayMsInput = document.querySelector('input[name="ollamaDelayMs"]');
        const fetchOllamaModelsButton = document.querySelector('button[name="fetchOllamaModels"]');
        const defaultButton = document.querySelector('button[name="default"]');
        const settingsForm = document.querySelector('.settings-form');
        function saveApiSettings(event) {
            event.preventDefault();
            const userInputSettings = {
                ...getFromStorage('apiSettings'),
                ...getFormData('.settings-form', { includeEmpty: true }),
            };
            saveToStorage('apiSettings', userInputSettings);
            log('Api settings saved');
        }
        async function fetchAndStoreOllamaModels() {
            const currentSettings = normalizeExtensionSettings({
                ...getFromStorage('apiSettings'),
                ...getFormData('.settings-form', { includeEmpty: true }),
            });
            try {
                if (fetchOllamaModelsButton)
                    fetchOllamaModelsButton.textContent = 'Fetching...';
                const models = await fetchOllamaModels(currentSettings);
                populateOllamaModelOptions(models);
                saveToStorage('apiSettings', {
                    ...currentSettings,
                    ollamaModels: models,
                    ollamaModel: currentSettings.ollamaModel || models[0] || '',
                });
                if (ollamaModelInput && !ollamaModelInput.value && models[0]) {
                    ollamaModelInput.value = models[0];
                }
                log(`Ollama: Found ${models.length} models`);
            }
            catch (error) {
                log(`Ollama model fetch failed: ${String(error)}`, 'error');
            }
            finally {
                if (fetchOllamaModelsButton)
                    fetchOllamaModelsButton.textContent = 'Fetch Models';
            }
        }
        function restoreApiDefaults(event) {
            event?.preventDefault();
            saveToStorage('apiSettings', apiSettingsDefault);
            maxConcurrentSingleApiReqInput.value = String(apiSettingsDefault.maxConcurrentSingleApiReq);
            maxConcurrentBatchApiReqInput.value = String(apiSettingsDefault.maxConcurrentBatchApiReq);
            operationSizeInput.value = String(apiSettingsDefault.operationSize);
            lockedFolderOpSizeInput.value = String(apiSettingsDefault.lockedFolderOpSize);
            infoSizeInput.value = String(apiSettingsDefault.infoSize);
            if (aiProviderInput) aiProviderInput.value = apiSettingsDefault.aiProvider;
            if (geminiDelayMsInput) geminiDelayMsInput.value = String(apiSettingsDefault.geminiDelayMs);
            if (ollamaBaseUrlInput) ollamaBaseUrlInput.value = apiSettingsDefault.ollamaBaseUrl;
            populateOllamaModelOptions(apiSettingsDefault.ollamaModels);
            if (ollamaModelInput) {
                const currentModel = apiSettingsDefault.ollamaModel;
                if (currentModel && !(apiSettingsDefault.ollamaModels ?? []).includes(currentModel)) {
                    const option = document.createElement('option');
                    option.value = currentModel;
                    option.textContent = currentModel;
                    ollamaModelInput.appendChild(option);
                }
                ollamaModelInput.value = currentModel;
            }
            if (ollamaDelayMsInput) ollamaDelayMsInput.value = String(apiSettingsDefault.ollamaDelayMs);
            updateAiProviderSettingsVisibility();
            log('Default api settings restored');
        }
        const restoredSettings = getFromStorage('apiSettings');
        maxConcurrentSingleApiReqInput.value =
            String(restoredSettings?.maxConcurrentSingleApiReq ?? apiSettingsDefault.maxConcurrentSingleApiReq);
        maxConcurrentBatchApiReqInput.value =
            String(restoredSettings?.maxConcurrentBatchApiReq ?? apiSettingsDefault.maxConcurrentBatchApiReq);
        operationSizeInput.value = String(restoredSettings?.operationSize ?? apiSettingsDefault.operationSize);
        lockedFolderOpSizeInput.value = String(restoredSettings?.lockedFolderOpSize ?? apiSettingsDefault.lockedFolderOpSize);
        infoSizeInput.value = String(restoredSettings?.infoSize ?? apiSettingsDefault.infoSize);
        if (aiProviderInput) aiProviderInput.value = restoredSettings?.aiProvider ?? apiSettingsDefault.aiProvider;
        if (geminiDelayMsInput) geminiDelayMsInput.value = String(restoredSettings?.geminiDelayMs ?? apiSettingsDefault.geminiDelayMs);
        if (ollamaBaseUrlInput) ollamaBaseUrlInput.value = restoredSettings?.ollamaBaseUrl ?? apiSettingsDefault.ollamaBaseUrl;
        if (ollamaModelInput) ollamaModelInput.value = restoredSettings?.ollamaModel ?? apiSettingsDefault.ollamaModel;
        if (ollamaDelayMsInput) ollamaDelayMsInput.value = String(restoredSettings?.ollamaDelayMs ?? apiSettingsDefault.ollamaDelayMs);
        populateOllamaModelOptions(restoredSettings?.ollamaModels ?? apiSettingsDefault.ollamaModels);
        updateAiProviderSettingsVisibility();
        // Add event listener for form submission
        settingsForm?.addEventListener('submit', saveApiSettings);
        aiProviderInput?.addEventListener('change', updateAiProviderSettingsVisibility);
        fetchOllamaModelsButton?.addEventListener('click', fetchAndStoreOllamaModels);
        // Add event listener for "Default" button click
        defaultButton?.addEventListener('click', restoreApiDefaults);
    }

    function filterListenersSetUp() {
        function resetDateInput() {
            const parent = this.parentNode;
            const closestInput = parent?.querySelector('input');
            if (closestInput)
                closestInput.value = '';
            updateUI();
        }
        function toggleClicked() {
            this.classList.add('clicked');
            setTimeout(() => {
                this.classList.remove('clicked');
            }, 500);
        }
        function resetAllFilters() {
            const form = document.querySelector('.filters-form');
            form?.reset();
            // Manually clear multi-selects and active state styling
            const selects = form?.querySelectorAll('select');
            selects?.forEach(select => {
                for (let i = 0; i < select.options.length; i++) {
                    select.options[i].selected = select.options[i].defaultSelected;
                }
            });
            const details = form?.querySelectorAll('details');
            details?.forEach(d => d.classList.remove('filter-active'));
            const fieldsets = form?.querySelectorAll(':scope > fieldset');
            fieldsets?.forEach(f => f.classList.remove('filter-active'));
            updateUI();
        }
        const resetDateButtons = document.querySelectorAll('[name="dateReset"]');
        for (const resetButton of resetDateButtons) {
            resetButton?.addEventListener('click', resetDateInput);
        }
        // Reset all filters button
        const filterResetButton = document.querySelector('#filterResetButton');
        filterResetButton?.addEventListener('click', resetAllFilters);
        const albumOnlyDedupe = document.querySelector('input[name="albumOnlyDedupe"]');
        albumOnlyDedupe?.addEventListener('change', () => {
            if (albumOnlyDedupe instanceof HTMLInputElement && albumOnlyDedupe.checked) {
                selectSource('albums');
                autoSelectCurrentAlbum();
                const thresholdInput = document.querySelector('input[name="similarityThreshold"]');
                if (thresholdInput instanceof HTMLInputElement && !thresholdInput.value) {
                    thresholdInput.value = '0.95';
                }
            }
            updateUI();
        });
        // Date reset button animation
        const dateResets = document.querySelectorAll('.date-reset');
        for (const reset of dateResets) {
            reset?.addEventListener('click', toggleClicked);
        }
    }

    function registerMenuCommand() {
        // GM_registerMenuCommand only exists in Tampermonkey/Greasemonkey context.
        // In the Chrome extension context it is undefined — guard it to avoid a crash.
        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand('Open GPTK window', function () {
                showMainMenu();
            });
        }
    }

    function initUI() {
        console.log('GPTK: Booting Durable UI');
        // 1. Setup the reload-loop and handle URL changes
        initDurableUi();
        
        // 2. Global observers/handlers that only need to be setup once
        setupMutationObserver();
        attachNavListeners();

        // Register the userscript menu command (no-op in extension context).
        registerMenuCommand();

        // 3. Confirm exit if process is running
        window.addEventListener('beforeunload', function (e) {
            if (unsafeWindow.gptkCore.isProcessRunning) {
                e.preventDefault();
            }
        });
    }

    // Boot guard: wait for WIZ_global_data before launching the UI.
    // The script tag fires as soon as it's appended but Google Photos sets up
    // WIZ_global_data asynchronously — polling prevents a crash on early inject.
    (function waitForWizAndBoot() {
        if (unsafeWindow.WIZ_global_data && unsafeWindow.WIZ_global_data.oPEP7c) {
            console.log('GPTK: WIZ_global_data ready — booting');
            initUI();
        } else {
            let attempts = 0;
            const maxAttempts = 100; // 10 seconds
            const poll = setInterval(() => {
                attempts++;
                if (unsafeWindow.WIZ_global_data && unsafeWindow.WIZ_global_data.oPEP7c) {
                    clearInterval(poll);
                    console.log(`GPTK: WIZ_global_data ready after ${attempts * 100}ms — booting`);
                    initUI();
                } else if (attempts >= maxAttempts) {
                    clearInterval(poll);
                    // Boot anyway — the UI will still work, just without account-specific storage
                    console.warn('GPTK: WIZ_global_data not found after 10s — booting anyway');
                    initUI();
                }
            }, 100);
        }
    })();

})();

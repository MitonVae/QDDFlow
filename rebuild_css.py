css = """/* ===== CSS Variables & Themes ===== */
:root {
  --bg-app: #1a1c22; --bg-toolbar: #12141a; --bg-panel: #1e2028;
  --bg-panel-item: #252830; --bg-panel-item-active: #2e3240; --bg-preview: #13151c;
  --border: #353a4a; --text-primary: #e8eaf0; --text-secondary: #8b90a0;
  --text-muted: #555d72; --accent: #7c6af7; --accent2: #4ecdc4; --accent-hover: #9480ff;
  --btn-bg: #2a2d3a; --btn-hover: #353a4a; --danger: #e55;
  --shadow: 0 2px 12px rgba(0,0,0,0.4); --radius: 8px; --radius-sm: 5px;
}
body.theme-light {
  --bg-app:#f0f2f7;--bg-toolbar:#fff;--bg-panel:#e8eaf2;--bg-panel-item:#fff;
  --bg-panel-item-active:#eef0fa;--bg-preview:#dde0ea;--border:#d0d4e0;
  --text-primary:#1a1c28;--text-secondary:#555d72;--text-muted:#9099b0;
  --accent:#5b4de8;--btn-bg:#e8eaf2;--btn-hover:#d8dbea;--shadow:0 2px 12px rgba(0,0,0,0.12);
}
body.theme-cyber {
  --bg-app:#0d0117;--bg-toolbar:#100120;--bg-panel:#140225;--bg-panel-item:#1a0530;
  --bg-panel-item-active:#220645;--bg-preview:#0a0015;--border:#4a0080;
  --text-primary:#f0d0ff;--text-secondary:#b060d0;--text-muted:#6030a0;
  --accent:#cc44ff;--btn-bg:#1e0440;--btn-hover:#2a0560;--shadow:0 2px 20px rgba(200,0,255,0.3);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;font-family:'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;}
body{background:var(--bg-app);color:var(--text-primary);transition:background .3s,color .3s;}
#app{display:flex;flex-direction:column;height:100vh;overflow:hidden;}

/* Toolbar */
#toolbar{display:flex;align-items:center;justify-content:space-between;padding:0 16px;height:52px;min-height:52px;background:var(--bg-toolbar);border-bottom:1px solid var(--border);box-shadow:var(--shadow);gap:12px;z-index:100;}
.toolbar-left{display:flex;align-items:center;gap:12px;flex-shrink:0;}
.toolbar-center{display:flex;align-items:center;gap:8px;}
.toolbar-right{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.app-title{font-size:17px;font-weight:700;color:var(--accent);letter-spacing:.5px;white-space:nowrap;}
#questTitle{background:var(--btn-bg);border:1px solid var(--border);color:var(--text-primary);border-radius:var(--radius-sm);padding:5px 10px;font-size:14px;width:240px;transition:border-color .2s;}
#questTitle:focus{outline:none;border-color:var(--accent);}
.tb-btn{display:flex;align-items:center;gap:5px;background:var(--btn-bg);border:1px solid var(--border);color:var(--text-primary);border-radius:var(--radius-sm);padding:5px 10px;font-size:13px;cursor:pointer;transition:background .2s,border-color .2s;white-space:nowrap;user-select:none;}
.tb-btn:hover{background:var(--btn-hover);border-color:var(--accent);}
.tb-btn select{background:transparent;border:none;color:var(--text-primary);font-size:13px;cursor:pointer;outline:none;}
.icon-btn{cursor:pointer;}
.tb-slider-btn{flex-direction:column;align-items:flex-start;gap:3px;padding:4px 10px;min-width:130px;}
.tb-slider-btn span{font-size:12px;color:var(--text-secondary);}
.tb-slider-btn input[type=range]{width:100%;accent-color:var(--accent);cursor:pointer;height:4px;}
.tb-back-btn{font-weight:600;}
.quest-name-wrap{display:flex;align-items:center;}
.tb-undo-btn{font-size:13px;min-width:60px;}
.tb-undo-btn:disabled{opacity:.35;cursor:not-allowed;}
.tb-divider{display:inline-block;width:1px;height:18px;background:var(--border);margin:0 2px;vertical-align:middle;}
.tb-autosave-label{font-size:11px;color:var(--text-muted);white-space:nowrap;padding:0 4px;}

/* Main layout */
#main{display:flex;flex:1;overflow:hidden;}
#editor-panel{width:220px;min-width:180px;max-width:280px;background:var(--bg-panel);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;}
#editor-panel-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 8px;font-size:13px;font-weight:600;color:var(--text-primary);border-bottom:1px solid var(--border);flex-shrink:0;}
#editor-panel-header small{font-size:11px;color:var(--text-muted);font-weight:400;}
#steps-list{flex:1;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:4px;}
#steps-list-footer{padding:10px 12px;border-top:1px solid var(--border);flex-shrink:0;}
.sl-add-btn{width:100%;padding:8px;border:1px dashed var(--accent);border-radius:var(--radius-sm);background:none;color:var(--accent);font-size:13px;font-weight:600;cursor:pointer;transition:background .12s;}
.sl-add-btn:hover{background:color-mix(in srgb,var(--accent) 10%,transparent);}

/* Step items */
.step-item{display:flex;align-items:center;gap:7px;padding:7px 8px;border-radius:var(--radius-sm);cursor:pointer;transition:background .15s;border:1px solid transparent;}
.step-item:hover{background:var(--bg-panel-item);}
.step-item.active{background:var(--bg-panel-item-active);border-color:var(--accent);}
.step-item.dragging{opacity:.4;}
.step-drag-handle{color:var(--text-muted);cursor:grab;font-size:14px;flex-shrink:0;user-select:none;}
.step-color-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.step-item-name{flex:1;font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.step-type-badge{display:inline-block;font-size:10px;font-weight:700;padding:1px 5px;border-radius:3px;background:var(--accent);color:white;opacity:.85;margin-left:4px;}
.step-item-actions{display:flex;gap:2px;flex-shrink:0;}
.step-item-actions button{background:none;border:none;cursor:pointer;font-size:13px;color:var(--text-muted);padding:2px 3px;border-radius:3px;transition:color .1s,background .1s;line-height:1;}
.step-item-actions button:hover{color:var(--text-primary);background:var(--btn-hover);}
.step-item-actions .del-btn:hover{color:var(--danger);}

/* Preview area */
#preview-area{flex:1;overflow:hidden;display:flex;flex-direction:column;position:relative;}
#preview-scroll-wrap{flex:1;overflow:auto;padding:20px;}
#preview-canvas{min-height:200px;}
.preview-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:300px;gap:12px;color:var(--text-muted);}
.empty-icon{font-size:48px;opacity:.3;}

/* Table layout */
.table-wrap{display:inline-block;min-width:max-content;}
.table-title-bar{font-size:15px;font-weight:700;color:var(--text-primary);padding:8px 2px 10px;letter-spacing:.3px;}
.qt-scroll{overflow-x:auto;}
.qt-table{border-collapse:collapse;border:1px solid #000;box-shadow:var(--shadow);background:var(--bg-panel);min-width:max-content;table-layout:auto;}
.qt-table>tbody>tr>td{border:1px solid #000;padding:0;vertical-align:top;}
.qt-step-cell{min-width:200px;width:240px;background:var(--bg-panel);vertical-align:top;}
.qt-step-inner{display:flex;flex-direction:column;height:100%;}
.qt-col-header{padding:10px 12px 8px;text-align:center;font-size:14px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.3);line-height:1.4;border-bottom:1px solid #000;flex-shrink:0;cursor:pointer;}
.qt-col-header:hover{filter:brightness(1.08);}
.qt-col-header [contenteditable]{outline:none;display:block;color:#fff;text-align:center;width:100%;word-break:break-word;}
.qt-col-header [contenteditable]:focus{background:rgba(255,255,255,.2);border-radius:3px;}
.qt-col-header-inner{display:flex;flex-direction:column;align-items:center;gap:0;}
.qt-col-header-inner .qt-editable{width:100%;text-align:center;word-break:break-word;}
.qt-type-badge{display:inline-block;align-self:center;margin-top:5px;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700;letter-spacing:.5px;background:rgba(0,0,0,.35);color:#fff;cursor:pointer;white-space:nowrap;border:1px solid rgba(0,0,0,.5);flex-shrink:0;transition:background .15s;user-select:none;}
.qt-type-badge:hover{background:rgba(0,0,0,.55);}
.qt-col-img{border-bottom:1px solid #000;flex-shrink:0;}
.qt-col-img img{width:100%;height:120px;object-fit:contain;background:#555;display:block;}
.qt-col-img-empty{height:60px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;gap:6px;position:relative;}
.qt-img-empty-hint{pointer-events:none;}
.qt-img-multi-wrap{display:flex;flex-wrap:wrap;gap:4px;padding:4px;min-height:60px;align-items:flex-start;}
.qt-img-thumb{flex:0 0 auto;width:calc(50% - 4px);cursor:zoom-in;overflow:hidden;border-radius:2px;}
.qt-img-thumb:only-child{width:100%;}
.qt-img-thumb img{width:100%;height:80px;object-fit:contain;background:#555;display:block;}
.qt-fields-table{width:100%;border-collapse:collapse;border-bottom:1px solid #000;flex-shrink:0;}
.qt-fields-table tr{border-bottom:1px solid #000;}
.qt-fields-table tr:last-child{border-bottom:none;}
.qt-fl{padding:7px 9px;font-size:13px;font-weight:700;color:var(--text-primary);white-space:nowrap;border-right:1px solid #000;vertical-align:top;width:1%;min-width:70px;background:color-mix(in srgb,var(--bg-panel) 85%,#000);}
.qt-fv{padding:7px 9px;font-size:13px;color:var(--text-secondary);line-height:1.5;word-break:break-word;outline:none;vertical-align:top;min-height:34px;transition:background .15s;}
.qt-fv:focus{background:color-mix(in srgb,var(--accent) 10%,transparent);}
.qt-fv:empty::before{content:'—';color:var(--text-muted);pointer-events:none;}
.qt-fv-select{cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:4px;user-select:none;}
.qt-fv-select:hover{background:var(--btn-hover);}
.qt-select-arrow{font-size:10px;color:var(--text-muted);flex-shrink:0;}
.qt-col-desc{padding:8px 10px;font-size:13px;color:var(--text-secondary);line-height:1.6;word-break:break-word;outline:none;min-height:80px;flex:1;transition:background .15s;}
.qt-col-desc:focus{background:color-mix(in srgb,var(--accent) 8%,transparent);}
.qt-col-desc:empty::before{content:'在此输入描述…';color:var(--text-muted);pointer-events:none;}

/* Image zones */
.qt-img-zone{position:relative;outline:none;cursor:default;transition:box-shadow .15s;}
.qt-col-img-empty.qt-img-zone,.tl-image-placeholder.qt-img-zone{cursor:pointer;}
.qt-img-zone.qt-img-focused{box-shadow:inset 0 0 0 2px var(--accent);}
.qt-img-zone.qt-img-drop-hover{box-shadow:inset 0 0 0 3px var(--accent)!important;opacity:.75;}
.qt-img-has-img{cursor:zoom-in;}
.qt-img-replace-btn{position:absolute;bottom:6px;right:6px;width:28px;height:28px;border-radius:50%;border:none;background:rgba(0,0,0,.55);color:#fff;font-size:13px;line-height:28px;text-align:center;cursor:pointer;opacity:0;transition:opacity .15s;z-index:2;padding:0;}
.qt-img-zone:hover .qt-img-replace-btn,.qt-img-zone.qt-img-focused .qt-img-replace-btn{opacity:1;}
.qt-img-replace-btn:hover{background:rgba(0,0,0,.8);}
.qt-img-replace-btn-always{opacity:.75!important;}
.qt-img-replace-btn-always:hover{opacity:1!important;}

/* Timeline layout */
.timeline-wrap{display:inline-block;min-width:max-content;padding-bottom:12px;}
.timeline-title-bar{font-size:15px;font-weight:700;color:var(--text-primary);padding:8px 2px 12px;}
.tl-grid{display:grid;gap:0;}
.tl-title-cell{padding:0 6px 10px 0;}
.tl-title-box{border-radius:var(--radius-sm);padding:10px 14px 8px;color:#fff;font-size:14px;font-weight:700;text-align:center;text-shadow:0 1px 3px rgba(0,0,0,.3);cursor:pointer;transition:filter .15s;}
.tl-title-box:hover{filter:brightness(1.08);}
.tl-title-inner{display:flex;flex-direction:column;align-items:center;gap:0;}
.tl-title-inner>span{width:100%;text-align:center;word-break:break-word;}
.tl-arrow-cell{display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:18px;padding:0 4px;}
.tl-img-cell{padding:0 6px 10px 0;}
.tl-image{width:100%;height:auto;display:block;border-radius:var(--radius-sm);}
.tl-image-placeholder{width:100%;min-height:80px;background:var(--bg-panel);border:1px dashed var(--border);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;position:relative;}
.tl-multi-img-strip{display:flex;gap:6px;overflow-x:auto;padding:0 0 4px;scrollbar-width:thin;}
.tl-image-thumb{flex:0 0 auto;height:140px;width:auto;max-width:240px;object-fit:contain;border-radius:var(--radius-sm);cursor:zoom-in;display:block;}
.tl-meta-cell{padding:0 6px 10px 0;}
.tl-meta{display:flex;flex-direction:column;gap:3px;}
.tl-meta-item{font-size:13px;color:var(--text-secondary);line-height:1.5;}
.tl-meta-item strong{color:var(--text-primary);font-weight:700;}
.tl-desc-cell{padding:0 6px 10px 0;}
.tl-desc{background:var(--bg-panel);border-radius:var(--radius-sm);padding:10px 12px;font-size:13px;color:var(--text-secondary);line-height:1.65;word-break:break-word;border:1px solid var(--border);}

/* Dropdowns */
.type-dropdown-menu{position:fixed;z-index:9999;background:var(--bg-toolbar);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:0 6px 20px rgba(0,0,0,.28);padding:4px 0;min-width:148px;animation:fadeInDown .12s ease;}
@keyframes fadeInDown{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}
.type-dropdown-item{display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;font-size:13px;color:var(--text-primary);transition:background .1s;}
.type-dropdown-item:hover{background:var(--btn-hover);}
.type-dropdown-item.active{background:var(--bg-panel-item-active);font-weight:700;}
.type-dd-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;display:inline-block;}
.type-dd-dot-empty{background:var(--text-muted)!important;opacity:.4;}

/* Step editor modal */
#step-editor{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:1000;}
#step-editor.hidden{display:none;}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
.editor-modal{background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);width:520px;max-width:95vw;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.5);}
.editor-modal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 12px;border-bottom:1px solid var(--border);flex-shrink:0;}
.editor-modal-header h3{font-size:15px;font-weight:700;}
.editor-modal-close{background:none;border:none;font-size:22px;color:var(--text-muted);cursor:pointer;line-height:1;padding:0;}
.editor-modal-close:hover{color:var(--text-primary);}
.editor-modal-body{flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:12px;}
.editor-modal-footer{display:flex;gap:10px;justify-content:flex-end;padding:12px 18px;border-top:1px solid var(--border);flex-shrink:0;}
.form-row{display:flex;flex-direction:column;gap:5px;}
.form-row label{font-size:12px;font-weight:600;color:var(--text-secondary);}
.form-row input[type=text],.form-row textarea,.form-row select{background:var(--btn-bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);padding:7px 10px;font-size:13px;font-family:inherit;transition:border-color .2s;outline:none;width:100%;}
.form-row input:focus,.form-row textarea:focus,.form-row select:focus{border-color:var(--accent);}
.form-row textarea{resize:vertical;min-height:80px;line-height:1.5;}
.form-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.btn-primary{background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .2s;}
.btn-primary:hover{opacity:.85;}
.btn-cancel{background:var(--btn-bg);color:var(--text-primary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 16px;font-size:13px;cursor:pointer;transition:background .2s;}
.btn-cancel:hover{background:var(--btn-hover);}
.color-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.color-presets{display:flex;gap:7px;flex-wrap:wrap;}
.color-preset-dot{width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform .15s,border-color .15s;}
.color-preset-dot:hover{transform:scale(1.15);}
.color-preset-dot.selected{border-color:var(--text-primary);transform:scale(1.15);}
.custom-color-input{width:70px;font-size:12px;}
.image-upload-area{border:1px dashed var(--border);border-radius:var(--radius-sm);overflow:hidden;transition:border-color .2s;}
.image-upload-area:hover,.image-upload-area.drag-over{border-color:var(--accent);}
.image-upload-preview{min-height:100px;display:flex;align-items:center;justify-content:center;background:var(--btn-bg);cursor:pointer;}
.image-upload-preview img{max-width:100%;max-height:200px;object-fit:contain;display:block;}
.image-upload-hint{font-size:13px;color:var(--text-muted);text-align:center;padding:20px;}
.image-upload-actions{display:flex;gap:8px;padding:8px 10px;border-top:1px solid var(--border);}
.img-action-btn{font-size:12px;padding:5px 10px;border:1px solid var(--border);background:var(--btn-bg);color:var(--text-primary);border-radius:var(--radius-sm);cursor:pointer;}
.img-action-btn:hover{background:var(--btn-hover);}
.img-clear-btn{color:var(--danger);border-color:var(--danger);}
.image-upload-url-row{display:flex;gap:6px;padding:0 10px 8px;}
.image-upload-url-row input{flex:1;font-size:12px;padding:5px 8px;background:var(--btn-bg);border:1px solid var(--border);color:var(--text-primary);border-radius:var(--radius-sm);outline:none;}
.image-upload-url-row button{font-size:12px;padding:5px 10px;background:var(--btn-bg);border:1px solid var(--border);color:var(--text-primary);border-radius:var(--radius-sm);cursor:pointer;}
.custom-fields-section{display:flex;flex-direction:column;gap:6px;}
.custom-fields-section>label{font-size:12px;font-weight:600;color:var(--text-secondary);}
.custom-field-row{display:grid;grid-template-columns:1fr 1fr 24px;gap:6px;align-items:center;}
.cf-key,.cf-val{padding:5px 8px;font-size:12px;background:var(--btn-bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);outline:none;width:100%;}
.cf-key:focus,.cf-val:focus{border-color:var(--accent);}
.custom-field-del{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:0;line-height:1;}
.custom-field-del:hover{color:var(--danger);}
.add-custom-field-btn{align-self:flex-start;background:none;border:none;color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;padding:0;}
.add-custom-field-btn:hover{opacity:.75;}

/* Home page */
.home-header{padding:32px 32px 16px;}
.home-header h2{font-size:22px;font-weight:700;color:var(--text-primary);}
.home-empty{color:var(--text-muted);font-size:14px;padding:20px;text-align:center;}
#qdd-card-list{display:flex;flex-wrap:wrap;gap:14px;padding:8px 32px 32px;}
.qdd-card{background:var(--bg-panel-item);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;min-width:200px;max-width:280px;flex:1;cursor:pointer;transition:border-color .2s,box-shadow .2s;display:flex;align-items:center;justify-content:space-between;gap:10px;}
.qdd-card:hover{border-color:var(--accent);box-shadow:0 2px 12px rgba(0,0,0,.2);}
.qdd-card-title{font-size:14px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.qdd-card-actions{display:flex;gap:4px;flex-shrink:0;}
.qdd-card-rename,.qdd-card-delete{background:none;border:none;font-size:14px;cursor:pointer;padding:3px 5px;border-radius:4px;opacity:.5;transition:opacity .15s,background .15s;}
.qdd-card-rename:hover{opacity:1;background:var(--btn-hover);}
.qdd-card-delete:hover{opacity:1;background:#ff6b6b22;}

/* Import modal */
#import-modal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:2000;}
#import-modal.hidden{display:none;}
.import-modal-box{background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);width:520px;max-width:95vw;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.5);}
.import-modal-box h3{font-size:14px;padding:14px 18px;border-bottom:1px solid var(--border);}
.import-modal-body{flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:8px;}
.import-modal-footer{display:flex;gap:10px;justify-content:flex-end;padding:12px 18px;border-top:1px solid var(--border);}
.import-map-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:center;font-size:13px;}
.import-map-row select{background:var(--btn-bg);border:1px solid var(--border);color:var(--text-primary);border-radius:var(--radius-sm);padding:5px 8px;font-size:12px;outline:none;}

/* Property panel */
.prop-panel{position:absolute;top:0;right:0;width:300px;height:100%;background:var(--bg-panel);border-left:1px solid var(--border);box-shadow:-4px 0 18px rgba(0,0,0,.13);z-index:50;display:flex;flex-direction:column;transition:transform .22s cubic-bezier(.4,0,.2,1);transform:translateX(0);overflow:hidden;}
.prop-panel-hidden{transform:translateX(105%);pointer-events:none;}
.prop-panel-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 10px;border-bottom:1px solid var(--border);background:var(--bg-toolbar);flex-shrink:0;}
.prop-panel-title{font-size:14px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.prop-panel-close{background:none;border:none;font-size:20px;color:var(--text-muted);cursor:pointer;line-height:1;padding:0 2px;flex-shrink:0;}
.prop-panel-close:hover{color:var(--text-primary);}
.prop-panel-body{flex:1;overflow-y:auto;padding:12px 14px 16px;display:flex;flex-direction:column;gap:10px;}
.pp-section{display:flex;flex-direction:column;gap:5px;}
.pp-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.pp-row2 .pp-label{font-size:11px;}
.pp-label{font-size:12px;font-weight:600;color:var(--text-primary);display:flex;align-items:center;justify-content:space-between;gap:6px;}
.pp-input,.pp-select,.pp-textarea{width:100%;padding:6px 8px;font-size:13px;color:var(--text-primary);background:var(--bg-app);border:1px solid var(--border);border-radius:var(--radius-sm);outline:none;box-sizing:border-box;font-family:inherit;transition:border-color .15s;}
.pp-input:focus,.pp-select:focus,.pp-textarea:focus{border-color:var(--accent);}
.pp-textarea{resize:vertical;min-height:80px;line-height:1.5;}
.pp-cf-list{display:flex;flex-direction:column;gap:6px;}
.pp-cf-row{display:grid;grid-template-columns:1fr 1fr 20px;gap:5px;align-items:center;}
.pp-cf-key,.pp-cf-val{padding:4px 7px;font-size:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-app);color:var(--text-primary);outline:none;}
.pp-cf-del{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:15px;line-height:1;padding:0;}
.pp-cf-del:hover{color:#e05;}
.pp-cf-add-btn,.pp-img-add-btn{background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;font-weight:600;padding:0;}
.pp-cf-add-btn:hover,.pp-img-add-btn:hover{opacity:.75;}
.pp-img-list{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;}
.pp-img-item{position:relative;width:80px;height:60px;border-radius:var(--radius-sm);overflow:hidden;border:1px solid var(--border);flex-shrink:0;}
.pp-img-item img{width:100%;height:100%;object-fit:cover;cursor:zoom-in;display:block;}
.pp-img-del{position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:12px;line-height:18px;text-align:center;cursor:pointer;padding:0;opacity:0;transition:opacity .12s;}
.pp-img-item:hover .pp-img-del{opacity:1;}
.pp-img-drop-zone{width:80px;height:60px;border:2px dashed var(--border);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted);cursor:pointer;text-align:center;padding:4px;transition:border-color .12s,background .12s;}
.pp-img-drop-zone:hover{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,transparent);}
.pp-danger-zone{flex-direction:row;gap:8px;margin-top:4px;padding-top:10px;border-top:1px solid var(--border);}
.pp-del-step-btn{flex:1;padding:7px;border:1px solid #e05;border-radius:var(--radius-sm);background:none;color:#e05;font-size:12px;cursor:pointer;font-weight:600;transition:background .12s;}
.pp-del-step-btn:hover{background:#ff000018;}
.pp-add-step-btn{flex:1;padding:7px;border:1px solid var(--accent);border-radius:var(--radius-sm);background:none;color:var(--accent);font-size:12px;cursor:pointer;font-weight:600;transition:background .12s;}
.pp-add-step-btn:hover{background:color-mix(in srgb,var(--accent) 10%,transparent);}

/* Image preview modal */
#img-preview-modal{position:fixed;inset:0;z-index:10000;}
.img-preview-backdrop{width:100%;height:100%;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;cursor:zoom-out;}
.img-preview-img{max-width:92vw;max-height:85vh;object-fit:contain;border-radius:var(--radius);box-shadow:0 8px 40px rgba(0,0,0,.6);animation:previewIn .18s ease;}
@keyframes previewIn{from{opacity:0;transform:scale(.92);}to{opacity:1;transform:scale(1);}}
.img-preview-hint{color:rgba(255,255,255,.45);font-size:13px;pointer-events:none;}

/* Toast */
#toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--bg-panel-item-active);color:var(--text-primary);border:1px solid var(--border);border-radius:20px;padding:8px 20px;font-size:13px;font-weight:500;box-shadow:var(--shadow);z-index:5000;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;}
#toast.show{opacity:1;transform:translateX(-50%) translateY(0);}

@media(max-width:768px){#editor-panel{width:200px;min-width:160px;}.form-grid-2{grid-template-columns:1fr;}}
"""

with open('style.css', 'w', encoding='utf-8') as f:
    f.write(css)

print('CSS rebuilt successfully, lines:', css.count('\\n'))

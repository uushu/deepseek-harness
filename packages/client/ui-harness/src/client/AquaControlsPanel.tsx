/**
 * Shared Aqua controls panel: the full glass settings surface (mode, material,
 * backdrop with fluid/wallpaper knobs, background brightness, and the ambient /
 * hover decorations). Used by both the General appearance row and the Theme
 * section's configuration tab, so the detailed settings live in one place.
 */
import { useRef } from 'react'
import { IconCheckOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { Knob, Segmented, fileToDataUrl } from './AquaControls.tsx'
import { saveVideoBlob, saveVideoHandle, loadVideoHandle } from './wallpaper-store.ts'
import type { AquaLocaleKey } from './locales.ts'
import css from './AquaAppearanceRow.module.css'

/** All Aqua layer knobs the panel reads. */
export interface AquaPanelValues {
  mode: 'mica' | 'compat'
  blur: number
  frost: number
  fluidHue: number
  fluidDepth: number
  bgBrightness: number
  dark: boolean
  background: 'fluid' | 'wallpaper'
  whale: boolean
  critters: boolean
  mesh: boolean
  spotlight: boolean
  press: boolean
  wallpaper: string
  wallpaperBlur: number
  wallpaperFrost: number
  videoBlur: number
  videoBrightness: number
}

/** All Aqua layer setters the panel writes. */
export interface AquaPanelSetters {
  setMode: (mode: 'mica' | 'compat') => void
  setBlur: (value: number) => void
  setFrost: (value: number) => void
  setFluidHue: (value: number) => void
  setFluidDepth: (value: number) => void
  setBgBrightness: (value: number) => void
  setBackground: (background: 'fluid' | 'wallpaper') => void
  setWallpaper: (value: string) => void
  setWhale: (value: boolean) => void
  setCritters: (value: boolean) => void
  setMesh: (value: boolean) => void
  setSpotlight: (value: boolean) => void
  setPress: (value: boolean) => void
  setWallpaperBlur: (value: number) => void
  setWallpaperFrost: (value: number) => void
  setVideoBlur: (value: number) => void
  setVideoBrightness: (value: number) => void
  authorizeVideo: () => void
}

export interface AquaControlsPanelProps {
  values: AquaPanelValues
  setters: AquaPanelSetters
  t: (key: AquaLocaleKey) => string
}

/** Render the full Aqua glass controls (mirrors the General appearance row). */
export function AquaControlsPanel({ values, setters, t }: AquaControlsPanelProps) {
  const {
    mode, blur, frost, fluidHue, fluidDepth, bgBrightness, dark, background,
    whale, critters, mesh, spotlight, press, wallpaper, wallpaperBlur,
    wallpaperFrost, videoBlur, videoBrightness,
  } = values
  const {
    setMode, setBlur, setFrost, setFluidHue, setFluidDepth, setBgBrightness,
    setBackground, setWallpaper, setWhale, setCritters, setMesh, setSpotlight,
    setPress, setWallpaperBlur, setWallpaperFrost, setVideoBlur,
    setVideoBrightness, authorizeVideo,
  } = setters
  const fileRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLInputElement | null>(null)

  // Videos are `idb:` blobs, `fsa:` remembered-file handles, or legacy
  // `data:video/` URLs.
  const isVideoWallpaper = wallpaper.startsWith('data:video/') || wallpaper.startsWith('idb:') || wallpaper.startsWith('fsa:')

  /** Pick a video. Chromium: File System Access — the browser remembers the
   *  file authorization, so later visits re-read the ORIGINAL file with no
   *  storage copy. Other browsers fall back to the plain file input. */
  const pickVideo = (): void => {
    const picker = window.showOpenFilePicker
    if (picker !== undefined) {
      void (async () => {
        try {
          const [handle] = await picker({
            multiple: false,
            types: [{ description: 'Video', accept: { 'video/*': ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv'] } }],
          })
          if (handle === undefined) return
          setBackground('wallpaper')
          if (await saveVideoHandle(handle)) {
            setWallpaper(`fsa:${handle.name}`)
          } else {
            // idb unavailable — degrade to the blob store / data URL path.
            const file = await handle.getFile()
            void saveVideoBlob(file).then((id) => {
              if (id !== '') setWallpaper(id)
              else void fileToDataUrl(file).then(setWallpaper)
            })
          }
        } catch {
          /* picker cancelled — keep current state */
        }
      })()
    } else {
      videoRef.current?.click()
    }
  }

  /** 选择视频 click: an fsa: video with stale permission re-authorizes in
   *  one click (no picker); anything else opens the picker. */
  const onChooseVideo = (): void => {
    if (wallpaper.startsWith('fsa:')) {
      void (async () => {
        const handle = await loadVideoHandle()
        if (handle !== null) {
          try {
            // queryPermission/requestPermission are part of the File System
            // Access API but not in every TS DOM lib — feature-detect them.
            const probe = handle as FileSystemFileHandle & {
              queryPermission?: (options: { mode: 'read' }) => Promise<'granted' | 'denied' | 'prompt'>
              requestPermission?: (options: { mode: 'read' }) => Promise<'granted' | 'denied' | 'prompt'>
            }
            let permission: 'granted' | 'denied' | 'prompt' = 'granted'
            if (probe.queryPermission !== undefined) {
              permission = await probe.queryPermission({ mode: 'read' })
              if (permission !== 'granted' && probe.requestPermission !== undefined) {
                permission = await probe.requestPermission({ mode: 'read' })
              }
            }
            if (permission === 'granted') {
              authorizeVideo()
              return
            }
          } catch {
            /* fall through to re-pick */
          }
        }
        pickVideo()
      })()
    } else {
      pickVideo()
    }
  }

  // The brightness knob only ever offers the half that makes sense for the
  // resolved scheme: dark mode darkens (0-50), light mode brightens (50-100).
  // The stored 0-100 value is clamped for display; writing always stays in
  // the offered range, so a value picked in one scheme is inert in the other.
  const bgMin = dark ? 0 : 50
  const bgMax = dark ? 50 : 100
  const bgDisplay = Math.min(bgMax, Math.max(bgMin, bgBrightness))

  return (
    <div className={css.group}>
      {/* 模式 */}
      <div className={css.subGroup}>
        <div className={css.subTitle}>{t('aqua.mode')}</div>
        <div className={css.controls}>
          <div className={css.row}>
            <Segmented
              label={t('aqua.mode')}
              value={mode}
              options={[
                { id: 'mica', label: t('aqua.modeMica') },
                { id: 'compat', label: t('aqua.modeCompat') },
              ]}
              onSelect={setMode}
            />
          </div>
        </div>
      </div>

      {/* 玻璃材质：仅云母模式 */}
      {mode === 'mica' && (
        <div className={css.subGroup}>
          <div className={css.subTitle}>{t('aqua.materialGroup')}</div>
          <div className={css.controls}>
            <Knob label={t('aqua.blur')} value={blur} min={0} max={40} step={0.5} unit="px" onChange={setBlur} />
            <Knob label={t('aqua.frost')} value={frost} min={0} max={100} step={1} unit="%" onChange={setFrost} />
          </div>
        </div>
      )}

      {/* 背景 */}
      <div className={css.subGroup}>
        <div className={css.subTitle}>{t('aqua.background')}</div>
        <div className={css.controls}>
          <div className={css.row}>
            <Segmented
              label={t('aqua.background')}
              value={background}
              options={[
                { id: 'fluid', label: t('aqua.backgroundFluid') },
                { id: 'wallpaper', label: t('aqua.backgroundWallpaper') },
              ]}
              onSelect={setBackground}
            />
          </div>

          {background === 'fluid' && (
            <>
              <Knob label={t('aqua.fluidHue')} value={fluidHue} min={0} max={360} step={1} unit="°" onChange={setFluidHue} />
              <Knob label={t('aqua.fluidDepth')} value={fluidDepth} min={0} max={100} step={1} unit="%" onChange={setFluidDepth} />
            </>
          )}

          {background === 'wallpaper' && (
            <>
              <div className={css.row}>
                <span className={css.rowLabel}>{t('aqua.wallpaper')}</span>
                <div className={css.wallpaperPick}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className={css.fileInput}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file !== undefined) {
                        setBackground('wallpaper')
                        void fileToDataUrl(file).then(setWallpaper)
                      }
                      e.target.value = ''
                    }}
                  />
                  <input
                    ref={videoRef}
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/quicktime"
                    className={css.fileInput}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file !== undefined) {
                        setBackground('wallpaper')
                        void saveVideoBlob(file).then((id) => {
                          if (id !== '') setWallpaper(id)
                          else void fileToDataUrl(file).then(setWallpaper)
                        })
                      }
                      e.target.value = ''
                    }}
                  />
                  <button type="button" className={css.pickButton} onClick={() => { fileRef.current?.click() }}>
                    {t('aqua.chooseImage')}
                  </button>
                  <button type="button" className={css.pickButton} onClick={onChooseVideo}>
                    {t('aqua.chooseVideo')}
                  </button>
                  {wallpaper !== '' && (
                    <button type="button" className={css.deleteButton} onClick={() => { setWallpaper('') }}>
                      {t('aqua.deleteWallpaper')}
                    </button>
                  )}
                </div>
              </div>
              <div className={css.knobHint}>{t('aqua.wallpaperHint')}</div>
              {!isVideoWallpaper && (
                <>
                  <Knob label={t('aqua.wallpaperBlur')} value={wallpaperBlur} min={0} max={40} step={0.5} unit="px" onChange={setWallpaperBlur} />
                  <Knob label={t('aqua.wallpaperFrost')} value={wallpaperFrost} min={0} max={100} step={1} unit="%" onChange={setWallpaperFrost} />
                </>
              )}
              {isVideoWallpaper && (
                <>
                  <Knob label={t('aqua.videoBlur')} value={videoBlur} min={0} max={40} step={0.5} unit="px" onChange={setVideoBlur} />
                  <Knob label={t('aqua.videoBrightness')} value={videoBrightness} min={0} max={100} step={1} unit="%" onChange={setVideoBrightness} />
                  <div className={css.knobHint}>{t('aqua.videoHint')}</div>
                </>
              )}
            </>
          )}

          <Knob label={t('aqua.bgBrightness')} value={bgDisplay} min={bgMin} max={bgMax} step={1} unit="%" onChange={setBgBrightness} />
          <div className={css.knobHint}>
            {t(dark ? 'aqua.bgBrightnessHintDark' : 'aqua.bgBrightnessHintLight')}
          </div>
        </div>
      </div>

      {/* 装饰：环境装饰 */}
      <div className={css.subGroup}>
        <div className={css.subTitle}>{t('aqua.decorAmbient')}</div>
        <div className={css.controls}>
          <div className={css.row}>
            <span className={css.rowLabel}>{t('aqua.whale')}</span>
            <button
              type="button"
              className={whale ? css.toggleOn : css.toggle}
              aria-pressed={whale}
              onClick={() => { setWhale(!whale) }}
            >
              <span className={css.check}>
                {whale && <IconCheckOutline16 />}
              </span>
              {whale ? t('aqua.enable') : t('aqua.disable')}
            </button>
          </div>
          <div className={css.row}>
            <span className={css.rowLabel}>{t('aqua.critters')}</span>
            <button
              type="button"
              className={critters ? css.toggleOn : css.toggle}
              aria-pressed={critters}
              onClick={() => { setCritters(!critters) }}
            >
              <span className={css.check}>
                {critters && <IconCheckOutline16 />}
              </span>
              {critters ? t('aqua.enable') : t('aqua.disable')}
            </button>
          </div>
          <div className={css.row}>
            <span className={css.rowLabel}>{t('aqua.mesh')}</span>
            <button
              type="button"
              className={mesh ? css.toggleOn : css.toggle}
              aria-pressed={mesh}
              onClick={() => { setMesh(!mesh) }}
            >
              <span className={css.check}>
                {mesh && <IconCheckOutline16 />}
              </span>
              {mesh ? t('aqua.enable') : t('aqua.disable')}
            </button>
          </div>
        </div>
      </div>

      {/* 装饰：悬停效果（仅云母模式的漂浮玻璃） */}
      {mode === 'mica' && (
        <div className={css.subGroup}>
          <div className={css.subTitle}>{t('aqua.decorHover')}</div>
          <div className={css.controls}>
            <div className={css.row}>
              <span className={css.rowLabel}>{t('aqua.spotlight')}</span>
              <button
                type="button"
                className={spotlight ? css.toggleOn : css.toggle}
                aria-pressed={spotlight}
                onClick={() => { setSpotlight(!spotlight) }}
              >
                <span className={css.check}>
                  {spotlight && <IconCheckOutline16 />}
                </span>
                {spotlight ? t('aqua.enable') : t('aqua.disable')}
              </button>
            </div>
            <div className={css.row}>
              <span className={css.rowLabel}>{t('aqua.press')}</span>
              <button
                type="button"
                className={press ? css.toggleOn : css.toggle}
                aria-pressed={press}
                onClick={() => { setPress(!press) }}
              >
                <span className={css.check}>
                  {press && <IconCheckOutline16 />}
                </span>
                {press ? t('aqua.enable') : t('aqua.disable')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

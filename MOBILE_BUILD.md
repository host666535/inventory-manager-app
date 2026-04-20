# Сборка мобильного APK для работы с локальным Docker-сервером

## Что уже настроено в коде

- `.env.production` — содержит IP твоего сервера: `http://192.168.2.139:3000`
- `capacitor.config.ts` — настройки Capacitor с разрешением HTTP-трафика
- `src/data/store.ts` и `src/data/auth.ts` — автоматически используют IP из `.env.production` при сборке APK

## Инструкция: от скачивания до APK

### 1. Скачай код и распакуй

Поместил проект в папку, например: `C:\Projects\stockbase`

### 2. Установи зависимости

Открой PowerShell в папке проекта:

```powershell
cd C:\Projects\stockbase
npm install
```

### 3. Запусти Docker

```powershell
docker-compose up -d
```

Проверь работу:
- На компе открой `http://192.168.2.139:3000` — должен открыться сайт
- **С телефона** в браузере тот же адрес — должен открыться сайт

Если с телефона НЕ открывается — разреши порт 3000 в брандмауэре (PowerShell от админа):

```powershell
New-NetFirewallRule -DisplayName "Docker StockBase 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### 4. Собери фронтенд

```powershell
npm run build
```

Это создаст папку `dist/` с собранным приложением.

### 5. Добавь Android-платформу в Capacitor (первый раз)

Если папки `android/` ещё нет:

```powershell
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
```

### 6. Синхронизируй Capacitor

```powershell
npx cap sync android
```

Эта команда:
- Скопирует `dist/` в `android/app/src/main/assets/public/`
- Применит настройки из `capacitor.config.ts` (включая `cleartext: true`)
- Подтянет плагины

### 7. Проверь манифест

Открой файл `android/app/src/main/AndroidManifest.xml` — в теге `<application>` должен быть атрибут:

```xml
android:usesCleartextTraffic="true"
```

Если его нет — добавь вручную. Capacitor его обычно прописывает сам из конфига.

Также убедись что есть разрешения (между `<manifest>` и `<application>`):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

### 8. Собери APK в Android Studio

Открой папку `android/` в Android Studio:

```powershell
npx cap open android
```

1. Дождись Sync Gradle
2. Нажми зелёную кнопку ▶️ (Run 'app')
3. APK установится на подключенный по USB телефон

## Проверка работы

1. На телефоне открой приложение
2. Подключи телефон к компу по USB
3. В Яндекс.Браузере на компе открой `browser://inspect`
4. Найди своё приложение → `inspect`
5. Во вкладке **Network** запросы должны идти на `http://192.168.2.139:3000/api/crud` и отвечать **200 OK**

## Если меняется IP компа

Если меняется Wi-Fi сеть или роутер — IP компа может поменяться. Тогда:

1. Узнай новый IP: `ipconfig` → IPv4-адрес Wi-Fi
2. Обнови в двух файлах:
   - `.env.production` → `VITE_API_URL=http://НОВЫЙ_IP:3000`
   - `capacitor.config.ts` → в массив `allowNavigation` добавь новый IP
3. Пересобери: `npm run build && npx cap sync android`
4. В Android Studio ▶️ — новый APK

## Чек-лист

- [ ] Docker запущен (`docker-compose up -d`)
- [ ] С компа открывается `http://192.168.2.139:3000`
- [ ] С телефона в браузере открывается `http://192.168.2.139:3000`
- [ ] Телефон и комп в одной Wi-Fi сети
- [ ] Брандмауэр пропускает порт 3000
- [ ] В `.env.production` правильный IP
- [ ] `npm run build` выполнен
- [ ] `npx cap sync android` выполнен
- [ ] В `AndroidManifest.xml` есть `usesCleartextTraffic="true"`

# Personal Website with 3D Room

A modern personal website featuring a rotating 3D room built with Three.js, complete with modal navigation and audio player.

## Features

- 🏠 **3D Rotating Room** - Interactive Three.js scene with furniture and lighting
- 🎵 **Audio Player** - Custom audio controls in the top-left corner
- 📱 **Modal Navigation** - Glassmorphism design with smooth animations
- ✨ **Visual Effects** - Reflection effects and responsive design
- 📄 **Content Sections** - About, Projects, Experience, Education, Contact

## Local Development

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd sabpdo.github.io-1

# Install dependencies
npm install
```

### Running Locally

#### Option 1: Live Server (Recommended)

```bash
npm run dev
```

Opens at http://localhost:3000 with live reload

#### Option 2: Python HTTP Server

```bash
python3 -m http.server 8000
```

Opens at http://localhost:8000

#### Option 3: VS Code Live Server

1. Install "Live Server" extension
2. Right-click on `index.html`
3. Select "Open with Live Server"

## Deployment

### GitHub Pages (Free)

1. **Push to GitHub:**

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/sabpdo.github.io-1.git
   git push -u origin main
   ```

2. **Enable GitHub Pages:**

   - Go to your repository on GitHub
   - Click "Settings" tab
   - Scroll to "Pages" section
   - Select "Deploy from a branch"
   - Choose "main" branch
   - Click "Save"

3. **Your site will be available at:**
   `https://yourusername.github.io/sabpdo.github.io-1/`

### Alternative Deployment Options

- **Netlify**: Drag and drop your project folder
- **Vercel**: Connect your GitHub repository
- **Firebase Hosting**: Use Firebase CLI
- **Surge.sh**: `npm install -g surge && surge`

## Technologies Used

- **Three.js** - 3D graphics library
- **HTML5** - Structure
- **CSS3** - Styling with glassmorphism effects
- **JavaScript** - Interactivity and 3D scene management
- **Font Awesome** - Icons

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

MIT License - feel free to use this template for your own personal website!

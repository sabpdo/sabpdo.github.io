# Sabrina's Personal Website!

A modern personal website featuring a rotating 3D room built with Three.js, complete with modal navigation and audio player.

## Local Development

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/sabpdo/sabpdo.github.io
cd sabpdo.github.io-1

# Install dependencies
npm install
```

### Running Locally

#### Option 1: Live Server (Recommended)

```bash
npm i -D live-server && npm run dev
```

Opens at http://localhost:3000 with live reload

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

## Minimization

To facilitate loading, I minimize the script size with 
```
cd /Users/sabrinado/sabpdo.github.io-1 && npx terser script.js -o script.min.js -c -m
```
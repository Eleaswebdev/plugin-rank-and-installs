import PluginOverview from './components/PluginOverview';
import ApiAccess from './components/ApiAccess';

export default function App() {
  return (
    <div className="min-h-screen bg-[#F5F5F0] py-12">
      <div className="max-w-4xl mx-auto px-6 mb-12">
        <h2 className="font-serif text-4xl text-stone-900 tracking-tight">
          WP Install <span className="italic text-emerald-700">Estimator</span>
        </h2>
        <p className="text-stone-500 mt-2">
          Interpolating accurate active install counts from WordPress.org popularity brackets.
        </p>
      </div>
      
      <PluginOverview slug="ti-woocommerce-wishlist" />
      
      <ApiAccess />
      
      <footer className="max-w-4xl mx-auto px-6 mt-20 pt-8 border-t border-stone-200 text-stone-400 text-xs flex justify-between items-center">
        <p>© 2026 WP Insights Tool</p>
        <div className="flex gap-4">
          <a href="https://wordpress.org/plugins/browse/popular/" target="_blank" rel="noreferrer" className="hover:text-stone-600 transition-colors">Source: WP.org Popularity</a>
          <span>•</span>
          <span>Algorithm: Linear Interpolation</span>
        </div>
      </footer>
    </div>
  );
}

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Package } from 'lucide-react';
import { useQuery } from 'react-query';
import { productosApi, sesionesApi } from '../services/api';

/**
 * SearchProductModal
 * Refactored search modal to isolate re-renders, add keyboard navigation, 
 * and show previous inventory indicators.
 */
const SearchProductModal = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  clienteId,
  onOpenCreate 
}) => {
  const [nombreBusqueda, setNombreBusqueda] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const searchInputRef = useRef(null);
  const resultsRef = useRef(null);

  // Fetch previous inventory for this client
  const { data: previousSessionData } = useQuery(
    ['previous-session-data', clienteId],
    async () => {
      if (!clienteId) return null;
      try {
        // Fetch the last completed sessions for this client
        const response = await sesionesApi.getByClient(clienteId, { 
          limite: 1, 
          estado: 'completada' 
        });
        
        const sesiones = response.data?.datos?.sesiones || response.data?.sesiones || [];
        return sesiones[0] || null;
      } catch (error) {
        console.error('Error fetching previous session:', error);
        return null;
      }
    },
    { 
      enabled: !!clienteId && isOpen,
      staleTime: 5 * 60 * 1000 // 5 minutes cache
    }
  );

  // Create a map for quick lookup of previous quantities
  const mapaAnterior = useMemo(() => {
    const mapa = {};
    if (previousSessionData?.productosContados) {
      previousSessionData.productosContados.forEach(p => {
        // Use name or barcode as key (normalized)
        const key = p.nombreProducto?.toLowerCase().trim();
        if (key) {
          mapa[key] = p.cantidadContada;
        }
      });
    }
    return mapa;
  }, [previousSessionData]);

  // Initial load of general products
  useEffect(() => {
    if (isOpen) {
      const loadInitialProducts = async () => {
        setIsSearching(true);
        try {
          const response = await productosApi.getAllGenerales({ 
            limite: 50, 
            soloActivos: true 
          });
          const raw = response.data?.datos;
          const list = Array.isArray(raw) ? raw : (raw?.productos || []);
          setSearchResults(list);
        } catch (error) {
          console.error('Error loading initial products:', error);
        } finally {
          setIsSearching(false);
          setActiveIndex(0);
        }
      };
      loadInitialProducts();
      
      // Focus input
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setNombreBusqueda('');
      setSearchResults([]);
    }
  }, [isOpen]);

  // Search logic with debounce
  useEffect(() => {
    if (!isOpen || nombreBusqueda.length < 3) return;

    const search = async () => {
      setIsSearching(true);
      try {
        const response = await productosApi.getAllGenerales({ 
          buscar: nombreBusqueda, 
          limite: 100, 
          soloActivos: true 
        });
        const raw = response.data?.datos;
        const list = Array.isArray(raw) ? raw : (raw?.productos || []);
        
        // Ensure consistent IDs
        const processed = list.map(p => ({
          ...p,
          _id: p.id || p._id || p.productoId
        }));
        
        setSearchResults(processed);
        setActiveIndex(0); // Reset selection
      } catch (error) {
        console.error('Error searching:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const delay = setTimeout(search, 300);
    return () => clearTimeout(delay);
  }, [nombreBusqueda, isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter' && searchResults.length > 0) {
        e.preventDefault();
        onSelect(searchResults[activeIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResults, activeIndex, onSelect, onClose]);

  // Auto-scroll logic
  useEffect(() => {
    if (resultsRef.current) {
      const activeElement = resultsRef.current.children[activeIndex];
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  const highlightMatch = (text, term) => {
    if (!text || !term || term.length < 2) return text;
    const parts = text.split(new RegExp(`(${term})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === term.toLowerCase() 
        ? <span key={i} className="bg-yellow-200 text-black font-bold px-0.5 rounded-sm">{part}</span> 
        : part
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-white rounded-md p-6 max-w-5xl w-full mx-4 shadow-2xl flex flex-col h-[80vh]">
        <div className="flex items-center justify-between mb-4 border-b pb-4">
          <div className="flex items-center space-x-3">
            <Search className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-bold text-slate-800">Buscar Producto por Nombre</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Input con mejor feedback visual */}
        <div className="relative mb-6">
          <input
            ref={searchInputRef}
            type="text"
            value={nombreBusqueda}
            onChange={(e) => setNombreBusqueda(e.target.value)}
            placeholder="Escribe el nombre del producto para buscar..."
            className="w-full pl-12 pr-4 py-4 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-xl text-slate-800 transition-all shadow-sm"
            autoComplete="off"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
          {isSearching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Header de la lista con leyendas */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-x rounded-t-lg">
          <span className="text-sm font-medium text-slate-600 uppercase tracking-wider">
            {nombreBusqueda.length >= 3 ? `Resultados para "${nombreBusqueda}"` : 'Productos frecuentes'}
          </span>
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
              <span>Nuevo</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded"></div>
              <span>Anterior</span>
            </div>
          </div>
        </div>

        {/* Lista de Resultados */}
        <div 
          ref={resultsRef}
          className="flex-1 border border-slate-200 rounded-b-lg overflow-y-auto bg-white divide-y divide-slate-100"
        >
          {searchResults.length === 0 && !isSearching ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
              <Package className="w-16 h-16 opacity-20" />
              <p className="text-lg">No se encontraron productos</p>
            </div>
          ) : (
            searchResults.map((producto, index) => {
              const prevQty = mapaAnterior[producto.nombre?.toLowerCase().trim()];
              const hasPrevious = prevQty !== undefined;
              
              return (
                <button
                  key={producto._id || producto.id}
                  onClick={() => onSelect(producto)}
                  className={`w-full px-6 py-4 text-left transition-all flex items-center justify-between group relative ${
                    index === activeIndex ? 'bg-blue-600 text-white' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex-1">
                    <div className={`font-bold text-lg ${index === activeIndex ? 'text-white' : 'text-slate-800'}`}>
                      {nombreBusqueda.length >= 3 ? highlightMatch(producto.nombre, nombreBusqueda) : producto.nombre}
                    </div>
                    <div className={`text-sm flex items-center space-x-2 mt-1 ${index === activeIndex ? 'text-blue-100' : 'text-slate-500'}`}>
                      <span className="bg-slate-200/50 px-2 py-0.5 rounded text-xs uppercase font-semibold">
                        {producto.categoria || 'General'}
                      </span>
                      <span>•</span>
                      <span>{producto.unidad || 'Unidad'}</span>
                      {producto.codigoBarras && (
                        <>
                          <span>•</span>
                          <span>CB: {producto.codigoBarras}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    {/* Indicador de Inventario Anterior (Cuadro Amarillo/Verde) */}
                    <div 
                      className={`w-14 h-14 flex flex-col items-center justify-center rounded-md border-2 transition-transform group-hover:scale-110 ${
                        hasPrevious 
                          ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-100' 
                          : 'bg-yellow-100 border-yellow-300 text-yellow-700'
                      }`}
                    >
                      <span className="text-lg font-black leading-tight">
                        {hasPrevious ? prevQty : '0'}
                      </span>
                      <span className="text-[9px] uppercase font-bold opacity-80">Ant.</span>
                    </div>

                    <div className="text-right min-w-[100px]">
                      <div className={`text-2xl font-black ${index === activeIndex ? 'text-white' : 'text-blue-600'}`}>
                        ${(producto.costo || producto.costoBase || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </div>
                      <div className={`text-xs uppercase tracking-wider font-bold ${index === activeIndex ? 'text-blue-200' : 'text-slate-400'}`}>
                        Costo Actual
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              onOpenCreate(nombreBusqueda);
            }}
            className="flex items-center space-x-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-md font-bold shadow-lg shadow-emerald-100 transition-all transform hover:-translate-y-0.5"
          >
            <span className="text-xl">+</span>
            <span>CREAR PRODUCTO NUEVO</span>
          </button>
          
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-slate-400 text-xs">
              <span className="px-2 py-1 bg-slate-100 rounded border">↑↓</span>
              <span>Navegar</span>
              <span className="px-2 py-1 bg-slate-100 rounded border ml-2">ENTER</span>
              <span>Seleccionar</span>
            </div>
            <button
              onClick={onClose}
              className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold transition-all"
            >
              CERRAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchProductModal;

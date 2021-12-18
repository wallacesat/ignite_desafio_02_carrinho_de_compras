import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { Product, Stock } from '../types';

interface CartProviderProps {
  children: ReactNode;
}

interface UpdateProductAmount {
  productId: number;
  amount: number;
}

interface CartContextData {
  cart: Product[];
  addProduct: (productId: number) => Promise<void>;
  removeProduct: (productId: number) => void;
  updateProductAmount: ({ productId, amount }: UpdateProductAmount) => void;
}

const storageKey = '@RocketShoes:cart';

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: CartProviderProps): JSX.Element {

  const [cart, setCart] = useState<Product[]>([]);

  useEffect(() => {
    const storage = window.localStorage.getItem(storageKey);
    setCart(!!storage ? JSON.parse(storage) : []);
  }, []);

  const verifyStockedProductAmount = async (productId: number) => {
    const { data: stock } = await api.get<Stock>(`/stock/${productId}`);
    return stock.amount;
  }

  const addProduct = async (productId: number) => {
    try {
      const updatedCart = Array.from(cart);
      const existentProduct = updatedCart.find(p => p.id === productId);

      const stockAmount = await verifyStockedProductAmount(productId);
      const currentAmount = existentProduct ? existentProduct.amount : 0;
      const amount = currentAmount  + 1;

      if (amount > stockAmount) {
        toast.error('Quantidade solicitada fora de estoque');
        return;
      }

      if (existentProduct) {
        existentProduct.amount = amount;
      } else {
        const { data: product } = await api.get<Product>(`/products/${productId}`);
        const newProduct = {
          ...product,
          amount: 1
        };

        updatedCart.push(newProduct);
      }
      setCart(updatedCart);
      window.localStorage.setItem(storageKey, JSON.stringify(updatedCart));

    } catch {
      toast.error('Erro na adição do produto');
    }
  };

  const removeProduct = (productId: number) => {
    try {
      if (!cart.find(c => c.id === productId)) {
        throw new Error('Erro na remoção do produto');
      }

      const updatedCart = cart.filter(strPrd => strPrd.id !== productId);

      setCart(updatedCart);
      window.localStorage.setItem(storageKey, JSON.stringify(updatedCart));
    } catch {
      toast.error('Erro na remoção do produto');
    }
  };

  const updateProductAmount = async ({
    productId,
    amount,
  }: UpdateProductAmount) => {
    try {
      if (amount <= 0) {
        return;
      }

      const stockedProductAmount = await verifyStockedProductAmount(productId);

      if (stockedProductAmount >= amount) {
        // produtos guardados no storage
        const storagedProductIndex = cart.findIndex(strPrd => strPrd.id === productId);

        setCart(oldCart => {
          const updatedCart = Array.from(oldCart);

          // atualiza amount do produto existente no storage
          updatedCart[storagedProductIndex] = {
            ...oldCart[storagedProductIndex],
            amount,
          }

          window.localStorage.setItem(storageKey, JSON.stringify(updatedCart));
          return updatedCart;
        });
      } else {
        toast.error('Quantidade solicitada fora de estoque');
      }
    } catch {
      toast.error('Erro na alteração de quantidade do produto');
    }
  };

  return (
    <CartContext.Provider
      value={{ cart, addProduct, removeProduct, updateProductAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextData {
  const context = useContext(CartContext);

  return context;
}

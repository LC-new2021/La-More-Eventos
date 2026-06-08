import CartaoClientPage from './CartaoClientPage';

export async function generateMetadata({ params }) {
  const { codigo } = await params;
  
  return {
    title: `Cartão Consumo - ${codigo.toUpperCase()}`,
    description: "Cartão de consumo virtual oficial La More Eventos",
    manifest: `/api/manifest/${codigo.toUpperCase()}`,
  };
}

export default function Page() {
  return <CartaoClientPage />;
}

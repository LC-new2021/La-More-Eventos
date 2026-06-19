import prisma from '@/lib/prisma';
import RegistrationClient from './RegistrationClient';

export default async function EventoRegistrationPage({ params }) {
  const { eventoId } = await params;
  
  const evento = await prisma.evento.findUnique({ 
    where: { id: eventoId }, 
    select: { id: true, nome: true } 
  });
  
  if (!evento) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <div className="text-6xl mb-4">🤷‍♂️</div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Evento não encontrado</h1>
          <p className="text-gray-500">Verifique o QR Code ou o link acessado.</p>
        </div>
      </div>
    );
  }

  return <RegistrationClient evento={evento} />;
}

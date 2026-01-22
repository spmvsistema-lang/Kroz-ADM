
import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { setGlobalOptions } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { format, set } from 'date-fns';
import next from 'next';

// 1. Configuração Global Única
setGlobalOptions({ 
    region: 'southamerica-east1',
    memory: "1GiB",
    timeoutSeconds: 60 
});

// Inicialização única
initializeApp();

// Opções para funções onCall
const callableOptions = { 
    cors: [
        /https:\/\/(\d+-)?firebase-studio-1767545534729\.cluster-[\w-]+\.cloudworkstations\.dev$/
    ],
    invoker: 'public'
};

// --- FUNÇÕES DE LÓGICA DE NEGÓCIOS ---

const createSuperadminFn = onCall(callableOptions, async (request) => {
    const { email, password, name, accessCode } = request.data;
    const expectedAccessCode = process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE || "KrozAdm@16";
    if (accessCode !== expectedAccessCode) {
        throw new HttpsError('invalid-argument', 'O código de acesso fornecido é inválido.');
    }
    if (!email || !password || !name) {
        throw new HttpsError('invalid-argument', 'Nome, email e senha são obrigatórios.');
    }
    try {
        const auth = getAuth();
        const firestore = getFirestore();
        const superAdminQuery = await firestore.collection('users').where('role', '==', 'Superadmin').limit(1).get();
        if (!superAdminQuery.empty && request.auth?.token.role !== 'Superadmin') {
            const usersList = await getAuth().listUsers();
            const superAdminUsers = usersList.users.filter(u => u.customClaims?.role === 'Superadmin');
            if (superAdminUsers.length > 0) {
                throw new HttpsError('permission-denied', 'Já existe um Super Admin. Apenas outro Super Admin pode criar contas adicionais.');
            }
        }
        const userRecord = await auth.createUser({
            email,
            password,
            displayName: name,
        });
        await auth.setCustomUserClaims(userRecord.uid, { role: 'Superadmin' });
        await firestore.collection("users").doc(userRecord.uid).set({
            name: name,
            email: email,
            role: "Superadmin",
            createdAt: new Date(),
        });
        return { success: true, uid: userRecord.uid, message: "Super Admin criado com sucesso." };
    } catch (error: any) {
        if (error.code === 'auth/email-already-exists') {
            throw new HttpsError('already-exists', 'Este endereço de e-mail já está em uso.');
        }
        logger.error("Error creating Superadmin:", error);
        throw new HttpsError('internal', 'Ocorreu um erro interno ao criar a conta de Super Admin.');
    }
});

const createClientUserFn = onCall(callableOptions, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'A autenticação é necessária.');
  }

  const { email, password, displayName, clientId, role } = request.data;
  if (!email || !password || !displayName || !clientId || !role) {
    throw new HttpsError('invalid-argument', 'Faltam dados obrigatórios.');
  }

  const callerUser = await getAuth().getUser(callerUid);
  const isSuperAdmin = callerUser.customClaims?.role === 'Superadmin';
  const isClientAdmin = callerUser.customClaims?.role === 'Admin' && callerUser.customClaims?.clientId === clientId;

  if (!isSuperAdmin && !isClientAdmin) {
    throw new HttpsError('permission-denied', 'Apenas Super Admins ou Admins do cliente podem criar usuários.');
  }

  try {
    const userRecord = await getAuth().createUser({ email, password, displayName });
    await getAuth().setCustomUserClaims(userRecord.uid, { clientId, role });
    const db = getFirestore();
    await db.collection('clients').doc(clientId).collection('users').doc(userRecord.uid).set({
      name: displayName,
      email: email,
      role: role,
      status: 'Ativo',
      createdAt: new Date(),
    });
    return { success: true, uid: userRecord.uid };
  } catch (error: any) {
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'E-mail já em uso.');
    }
    throw new HttpsError('internal', 'Erro interno.');
  }
});

const updateClientUserFn = onCall(callableOptions, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError('unauthenticated', 'A autenticação é necessária.');
    }
    const { clientId, userData } = request.data;
    const { id: userId, email, ...dataToUpdate } = userData;
    if (!clientId || !userId) {
        throw new HttpsError('invalid-argument', 'Faltam dados obrigatórios (clientId, userId).');
    }
    const callerUser = await getAuth().getUser(callerUid);
    const isSuperAdmin = callerUser.customClaims?.role === 'Superadmin';
    const isClientAdmin = callerUser.customClaims?.role === 'Admin' && callerUser.customClaims?.clientId === clientId;
    if (!isSuperAdmin && !isClientAdmin) {
        throw new HttpsError('permission-denied', 'Você não tem permissão para atualizar este usuário.');
    }
    try {
        const auth = getAuth();
        const db = getFirestore();
        await auth.setCustomUserClaims(userId, { clientId, role: dataToUpdate.role });
        const userRef = db.collection('clients').doc(clientId).collection('users').doc(userId);
        await userRef.update(dataToUpdate);
        return { success: true };
    } catch (error: any) {
        logger.error("Error updating client user:", error);
        throw new HttpsError('internal', 'Erro interno ao atualizar usuário.');
    }
});

const deleteClientUserFn = onCall(callableOptions, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError('unauthenticated', 'A autenticação é necessária.');
    }

    const { clientId, userId } = request.data;
    if (!clientId || !userId) {
        throw new HttpsError('invalid-argument', 'Faltam dados obrigatórios (clientId, userId).');
    }

    const callerUser = await getAuth().getUser(callerUid);
    const isSuperAdmin = callerUser.customClaims?.role === 'Superadmin';
    const isClientAdmin = callerUser.customClaims?.role === 'Admin' && callerUser.customClaims?.clientId === clientId;

    if (!isSuperAdmin && !isClientAdmin) {
        throw new HttpsError('permission-denied', 'Você não tem permissão para excluir este usuário.');
    }

    try {
        const auth = getAuth();
        const db = getFirestore();
        
        await auth.deleteUser(userId);

        const userRef = db.collection('clients').doc(clientId).collection('users').doc(userId);
        await userRef.delete();
        
        return { success: true };
    } catch (error: any) {
        logger.error("Error deleting client user:", error);
        throw new HttpsError('internal', 'Erro interno ao excluir usuário.');
    }
});


const createVeterinarianUserFn = onCall(callableOptions, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'A autenticação é necessária.');
  }
  const callerUser = await getAuth().getUser(callerUid);
  if (callerUser.customClaims?.role !== 'Admin' && callerUser.customClaims?.role !== 'Superadmin') {
    throw new HttpsError('permission-denied', 'Apenas Administradores podem criar veterinários.');
  }
  const { email, password, displayName, clientId, clinics, status, vetData } = request.data;
  if (!email || !password || !displayName || !clientId || !clinics || !status) {
    throw new HttpsError('invalid-argument', 'Faltam dados obrigatórios.');
  }
  try {
    const userRecord = await getAuth().createUser({ email, password, displayName });
    await getAuth().setCustomUserClaims(userRecord.uid, { clientId, role: 'veterinario' });
    const db = getFirestore();
    await db.collection('clients').doc(clientId).collection('veterinarians').doc(userRecord.uid).set({
      ...vetData,
      name: displayName,
      email: email,
      role: 'veterinario',
      status: status,
      clinics: clinics,
      createdAt: new Date(),
    });
    return { success: true, uid: userRecord.uid };
  } catch (error: any) {
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'E-mail já em uso.');
    }
    logger.error("Error creating veterinarian:", error);
    throw new HttpsError('internal', 'Erro interno ao criar veterinário.');
  }
});

const updateVeterinarianUserFn = onCall(callableOptions, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError('unauthenticated', 'A autenticação é necessária.');
    }
    const { clientId, vetData } = request.data;
    const { id: vetId, email, ...dataToUpdate } = vetData;
    if (!clientId || !vetId) {
        throw new HttpsError('invalid-argument', 'Faltam dados obrigatórios (clientId, vetId).');
    }
    const callerUser = await getAuth().getUser(callerUid);
    const isSuperAdmin = callerUser.customClaims?.role === 'Superadmin';
    const isClientAdmin = callerUser.customClaims?.role === 'Admin' && callerUser.customClaims?.clientId === clientId;
    if (!isSuperAdmin && !isClientAdmin) {
        throw new HttpsError('permission-denied', 'Apenas Administradores podem atualizar veterinários.');
    }
    try {
        const sanitizedData = Object.entries(dataToUpdate).reduce((acc, [key, value]) => {
            if (value !== undefined) {
                // @ts-ignore
                acc[key] = value;
            }
            return acc;
        }, {} as any);

        const auth = getAuth();
        const db = getFirestore();

        if (sanitizedData.name && typeof sanitizedData.name === 'string') {
           await auth.updateUser(vetId, {
                displayName: sanitizedData.name,
            });
        }
        
        const vetRef = db.collection('clients').doc(clientId).collection('veterinarians').doc(vetId);
        await vetRef.update(sanitizedData);
        
        return { success: true };
    } catch (error: any) {
        logger.error("Error updating veterinarian:", error);
        throw new HttpsError('internal', 'Erro interno ao atualizar veterinário.');
    }
});

const createSupplierUserFn = onCall(callableOptions, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError('unauthenticated', 'A autenticação é necessária.');
    }

    const { email, password, displayName, supplierId, clientId } = request.data;
    if (!email || !password || !displayName || !supplierId || !clientId) {
        throw new HttpsError('invalid-argument', 'Faltam dados obrigatórios (email, password, displayName, supplierId, clientId).');
    }

    const callerUser = await getAuth().getUser(callerUid);
    const isSuperAdmin = callerUser.customClaims?.role === 'Superadmin';
    const isClientAdmin = callerUser.customClaims?.role === 'Admin' && callerUser.customClaims?.clientId === clientId;

    if (!isSuperAdmin && !isClientAdmin) {
        throw new HttpsError('permission-denied', 'Apenas Super Admins ou Admins do cliente podem criar usuários para fornecedores.');
    }

    try {
        let userRecord;
        let existingClaims: { [key: string]: any; } = {};
        
        try {
            userRecord = await getAuth().getUserByEmail(email);
            
            if (userRecord.customClaims?.role !== 'fornecedor') {
                throw new HttpsError('already-exists', 'Este e-mail já está em uso por um usuário que não é um fornecedor.');
            }
            existingClaims = userRecord.customClaims || {};

        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                userRecord = await getAuth().createUser({ email, password, displayName });
                existingClaims = { role: 'fornecedor' }; // Start with the base role claim
            } else {
                throw error;
            }
        }
        
        // Update custom claims with the new client ID
        const supplierOf = (existingClaims.supplierOf || {}) as Record<string, boolean>;
        supplierOf[clientId] = true;

        await getAuth().setCustomUserClaims(userRecord.uid, {
            ...existingClaims, // preserve other existing claims
            role: 'fornecedor', // ensure role is set
            supplierOf: supplierOf,
        });
        
        const db = getFirestore();
        await db.collection('clients').doc(clientId).collection('suppliers').doc(supplierId).update({
            authUid: userRecord.uid
        });

        return { success: true, uid: userRecord.uid };
    } catch (error: any) {
        if (error instanceof HttpsError) {
            throw error;
        }
        if (error.code === 'auth/email-already-exists') {
            throw new HttpsError('already-exists', 'Este endereço de e-mail já está em uso.');
        }
        logger.error("Error creating or linking supplier user:", error);
        throw new HttpsError('internal', 'Erro interno ao criar ou vincular o usuário do fornecedor.');
    }
});


const updateClientFn = onCall(callableOptions, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError('unauthenticated', 'A autenticação é necessária.');
    }
    const { clientData } = request.data;
    const { id: clientId, ...dataToUpdate } = clientData;
    if (!clientId) {
        throw new HttpsError('invalid-argument', 'ID do cliente é obrigatório.');
    }
    const callerUser = await getAuth().getUser(callerUid);
    if (callerUser.customClaims?.role !== 'Superadmin') {
        throw new HttpsError('permission-denied', 'Apenas Super Admins podem atualizar clientes.');
    }
    try {
        const db = getFirestore();
        const clientRef = db.collection('clients').doc(clientId);
        await clientRef.update(dataToUpdate);
        return { success: true };
    } catch (error) {
        logger.error("Error updating client:", error);
        throw new HttpsError('internal', 'Erro ao atualizar cliente.');
    }
});

const deleteClientFn = onCall(callableOptions, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Erro de autenticação.');
  const callerUser = await getAuth().getUser(callerUid);
  if (callerUser.customClaims?.role !== 'Superadmin') {
    throw new HttpsError('permission-denied', 'Acesso negado.');
  }
  const { clientId } = request.data;
  const db = getFirestore();
  const clientRef = db.collection('clients').doc(clientId);
  try {
    const usersSnapshot = await clientRef.collection('users').get();
    if (!usersSnapshot.empty) {
      const uidsToDelete = usersSnapshot.docs.map(doc => doc.id);
      await getAuth().deleteUsers(uidsToDelete);
    }
    await db.recursiveDelete(clientRef);
    return { success: true };
  } catch (error) {
    throw new HttpsError('internal', 'Erro ao excluir cliente.');
  }
});

const generateVeterinarianPaymentsFn = onSchedule("0 5 1 * *", async (event) => {
    const db = getFirestore();
    const now = new Date();
    const currentMonthYear = format(now, 'yyyy-MM');
    logger.info(`Iniciando geração de pagamentos para veterinários - ${currentMonthYear}`);
    try {
        const clientsSnapshot = await db.collection('clients').get();
        for (const clientDoc of clientsSnapshot.docs) {
            const clientId = clientDoc.id;
            const vetsSnapshot = await db.collection('clients').doc(clientId).collection('veterinarians')
                .where('status', '==', 'Ativo')
                .get();
            if (vetsSnapshot.empty) {
                continue;
            }
            logger.info(`Processando ${vetsSnapshot.size} veterinários para o cliente ${clientId}`);
            for (const vetDoc of vetsSnapshot.docs) {
                const vetData = vetDoc.data();
                if (vetData.closingDay && vetData.closingDay > 0 && vetData.closingDay <= 31) {
                    const dueDate = set(now, { date: vetData.closingDay });
                    const paymentId = `${currentMonthYear}-${vetDoc.id}`;
                    const paymentRef = db.collection('clients').doc(clientId).collection('payments').doc(paymentId);
                    const paymentSnap = await paymentRef.get();
                    if (!paymentSnap.exists) {
                        await paymentRef.set({
                            veterinarianId: vetDoc.id,
                            veterinarianName: vetData.name,
                            dueDate: format(dueDate, 'yyyy-MM-dd'),
                            monthYear: currentMonthYear,
                            status: 'Pendente',
                            origin: 'Gerado Automaticamente',
                            value: 0,
                            createdAt: new Date(),
                            serviceNoteReceived: false,
                        });
                        logger.info(`Pagamento criado para ${vetData.name} (ID: ${vetDoc.id}) no cliente ${clientId}`);
                    }
                }
            }
        }
        logger.info("Geração de pagamentos concluída com sucesso.");
    } catch (error) {
        logger.error("Erro ao gerar pagamentos de veterinários:", error);
    }
});

const scheduleFinalVetPaymentFn = onCall(callableOptions, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError('unauthenticated', 'A autenticação é necessária.');
    }
    const { clientId, veterinarianId, dueDate } = request.data;
    if (!clientId || !veterinarianId || !dueDate) {
        throw new HttpsError('invalid-argument', 'Faltam dados obrigatórios (clientId, veterinarianId, dueDate).');
    }
    const callerUser = await getAuth().getUser(callerUid);
    const isSuperAdmin = callerUser.customClaims?.role === 'Superadmin';
    const isClientAdmin = callerUser.customClaims?.role === 'Admin' && callerUser.customClaims?.clientId === clientId;
    if (!isSuperAdmin && !isClientAdmin) {
        throw new HttpsError('permission-denied', 'Você não tem permissão para agendar este pagamento.');
    }
    const db = getFirestore();
    try {
        const vetRef = db.collection('clients').doc(clientId).collection('veterinarians').doc(veterinarianId);
        const vetSnap = await vetRef.get();
        if (!vetSnap.exists) {
            throw new HttpsError('not-found', 'Veterinário não encontrado.');
        }
        const vetData = vetSnap.data();
        if (!vetData) {
            throw new HttpsError('internal', 'Não foi possível ler os dados do veterinário.');
        }

        const paymentId = `final-${format(new Date(dueDate), 'yyyy-MM-dd')}-${veterinarianId}`;
        const paymentRef = db.collection('clients').doc(clientId).collection('payments').doc(paymentId);
        await paymentRef.set({
            veterinarianId: veterinarianId,
            veterinarianName: vetData.name,
            dueDate: format(new Date(dueDate), 'yyyy-MM-dd'),
            monthYear: format(new Date(dueDate), 'yyyy-MM'),
            status: 'Pendente',
            origin: 'Pagamento Final por Inativação',
            value: 0,
            createdAt: new Date(),
            serviceNoteReceived: false,
        });
        return { success: true, message: "Pagamento final agendado com sucesso." };
    } catch (error: any) {
        logger.error("Error scheduling final payment:", error);
        throw new HttpsError('internal', error.message || 'Erro ao agendar pagamento final.');
    }
});

const deletePurchaseOrderFn = onCall(callableOptions, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new HttpsError('unauthenticated', 'A autenticação é necessária.');
    }

    const { clientId, purchaseOrderId } = request.data;
    if (!clientId || !purchaseOrderId) {
        throw new HttpsError('invalid-argument', 'Faltam dados obrigatórios (clientId, purchaseOrderId).');
    }

    const callerUser = await getAuth().getUser(callerUid);
    const isSuperAdmin = callerUser.customClaims?.role === 'Superadmin';
    const isClientAdmin = callerUser.customClaims?.role === 'Admin' && callerUser.customClaims?.clientId === clientId;

    if (!isSuperAdmin && !isClientAdmin) {
        throw new HttpsError('permission-denied', 'Você não tem permissão para excluir esta ordem de compra.');
    }

    try {
        const db = getFirestore();
        const orderRef = db.collection('clients').doc(clientId).collection('purchaseOrders').doc(purchaseOrderId);
        await orderRef.delete();
        
        return { success: true };
    } catch (error: any) {
        logger.error("Error deleting purchase order:", error);
        throw new HttpsError('internal', 'Erro interno ao excluir a ordem de compra.');
    }
});

export const createSuperadmin = createSuperadminFn;
export const createClientUser = createClientUserFn;
export const updateClientUser = updateClientUserFn;
export const deleteClientUser = deleteClientUserFn;
export const createVeterinarianUser = createVeterinarianUserFn;
export const updateVeterinarianUser = updateVeterinarianUserFn;
export const createSupplierUser = createSupplierUserFn;
export const updateClient = updateClientFn;
export const deleteClient = deleteClientFn;
export const generateVeterinarianPayments = generateVeterinarianPaymentsFn;
export const scheduleFinalVetPayment = scheduleFinalVetPaymentFn;
export const deletePurchaseOrder = deletePurchaseOrderFn;


// --- FUNÇÃO DO SERVIDOR NEXT.JS ---

const isDev = process.env.NODE_ENV !== 'production';
const nextApp = next({
  dev: isDev,
  dir: '..', // Aponta para o diretório raiz do Next.js
});

const nextHandle = nextApp.getRequestHandler();

export const nextserver = onRequest({
    maxInstances: 10,
}, async (req, res) => {
  try {
    await nextApp.prepare();
    return nextHandle(req, res);
  } catch (err) {
    logger.error("Erro ao processar requisição Next.js:", err);
    res.status(500).send("Erro Interno do Servidor");
  }
});

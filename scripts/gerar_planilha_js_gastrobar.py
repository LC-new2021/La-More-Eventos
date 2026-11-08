import glob, openpyxl

UP = r'C:/Users/Usuário/.gemini/antigravity/brain/685055d4-e520-4c2d-b4e3-2cc4c6bad6c5/.user_uploaded/'
OUT = r'c:/Users/Usuário/Desktop/BILHETERIA_LA/bilheteria-lamore/importar_produtos_JS_GastroBar.xlsx'
tpl = sorted(glob.glob(UP + '*.xlsx'))[0]  # modelo importar_produtos

# (nome, valor, unidade, NCM, CEST, descricao)
NCM_CERV = '22030000'
CEST_CERV = '0302100'  # 03.021.00 Cerveja

G = {}
G['CERVEJAS'] = [
 ('HEINEKEN 600ML', 18.00, 'GR', NCM_CERV, CEST_CERV, 'Cerveja Heineken garrafa 600ml'),
 ('STELLA GOLD 600ML', 19.90, 'GR', NCM_CERV, CEST_CERV, 'Cerveja Stella Artois Gold garrafa 600ml'),
 ('AMSTEL 600ML', 16.00, 'GR', NCM_CERV, CEST_CERV, 'Cerveja Amstel garrafa 600ml'),
 ('ORIGINAL 600ML', 17.00, 'GR', NCM_CERV, CEST_CERV, 'Cerveja Original garrafa 600ml'),
 ('ANTARTICA 600ML', 15.00, 'GR', NCM_CERV, CEST_CERV, 'Cerveja Antarctica garrafa 600ml'),
 ('BRAHMA CHOPP 600ML', 14.00, 'GR', NCM_CERV, CEST_CERV, 'Cerveja Brahma Chopp garrafa 600ml'),
 ('SPATEN 600ML', 18.00, 'GR', NCM_CERV, CEST_CERV, 'Cerveja Spaten garrafa 600ml'),
 ('HEINEKEN LONG', 12.00, 'UN', NCM_CERV, CEST_CERV, 'Cerveja Heineken long neck 330ml'),
 ('CORONA LONG', 13.00, 'UN', NCM_CERV, CEST_CERV, 'Cerveja Corona long neck 330ml'),
 ('STELLA GOLD LONG', 12.00, 'UN', NCM_CERV, CEST_CERV, 'Cerveja Stella Artois Gold long neck 330ml'),
 ('BUDWEISER LONG', 12.00, 'UN', NCM_CERV, CEST_CERV, 'Cerveja Budweiser long neck 330ml'),
 ('SPATEN LONG', 12.00, 'UN', NCM_CERV, CEST_CERV, 'Cerveja Spaten long neck 330ml'),
 ('HEINEKEN LATAO', 10.00, 'LA', NCM_CERV, CEST_CERV, 'Cerveja Heineken lata 473ml (latão)'),
 ('AMSTEL LATAO', 8.00, 'LA', NCM_CERV, CEST_CERV, 'Cerveja Amstel lata 473ml (latão)'),
 ('SPATEN LATAO', 8.00, 'LA', NCM_CERV, CEST_CERV, 'Cerveja Spaten lata 473ml (latão)'),
 ('ANTARTICA LATA', 7.00, 'LA', NCM_CERV, CEST_CERV, 'Cerveja Antarctica lata 350ml'),
 ('BRAHMA LATA', 7.00, 'LA', NCM_CERV, CEST_CERV, 'Cerveja Brahma lata 350ml'),
 ('AMSTEL LATA', 7.00, 'LA', NCM_CERV, CEST_CERV, 'Cerveja Amstel lata 350ml'),
 ('ORIGINAL LATA', 8.00, 'LA', NCM_CERV, CEST_CERV, 'Cerveja Original lata 350ml'),
]
G['ICE'] = [
 ('51 ICE', 15.00, 'UN', '22089000', '', 'Bebida ice 51 Ice'),
 ('SMIRNOFF ICE', 15.00, 'UN', '22089000', '', 'Bebida ice Smirnoff Ice'),
 ('SKOL BEATS', 15.00, 'UN', '22089000', '', 'Bebida mista Skol Beats'),
 ('GIN TONICA GT', 15.00, 'UN', '22085000', '', 'Gin tônica GT pronta para beber'),
]
G['DRINKS'] = [
 ('CAIPIRINHA', 20.00, 'CP', '22089000', '', 'Caipirinha tradicional de limão'),
 ('CAIPIROSCA', 24.90, 'CP', '22089000', '', 'Caipiroska de vodka com limão'),
 ('CAPIFRUTA', 35.00, 'CP', '22089000', '', 'Caipirinha de frutas'),
 ('COZUMEL', 10.00, 'DS', '22089000', '', 'Dose de Cozumel'),
 ('CAIPIRISSIMA', 24.90, 'CP', '22089000', '', 'Caipiríssima de rum com limão'),
]
G['SEM ÁLCOOL'] = [
 ('REFRI LATA', 8.00, 'LA', '22021000', '0301100', 'Refrigerante lata 350ml'),
 ('REFRI 600ML', 12.00, 'UN', '22021000', '0301000', 'Refrigerante garrafa 600ml'),
 ('REFRI 1,5L', 14.00, 'UN', '22021000', '0301000', 'Refrigerante garrafa 1,5 litro'),
 ('REFRI 2L', 17.00, 'UN', '22021000', '0301000', 'Refrigerante garrafa 2 litros'),
 ('ENERGETICO RED BULL', 18.00, 'LA', '22029900', '0301300', 'Energético Red Bull lata'),
 ('ENERGETICO MONSTER', 16.00, 'LA', '22029900', '0301300', 'Energético Monster lata'),
 ('H2O 1,5L', 14.00, 'UN', '22021000', '0300700', 'Água saborizada H2O garrafa 1,5 litro'),
 ('H2O 500ML', 12.00, 'UN', '22021000', '0300700', 'Água saborizada H2O garrafa 500ml'),
 ('AGUA DE COCO P', 8.00, 'UN', '20098990', '', 'Água de coco tamanho pequeno'),
 ('AGUA DE COCO G', 14.00, 'UN', '20098990', '', 'Água de coco tamanho grande'),
 ('AGUA C GAS P', 6.00, 'UN', '22011000', '0300500', 'Água mineral com gás pequena'),
 ('AGUA C GAS G', 9.00, 'UN', '22011000', '0300400', 'Água mineral com gás grande'),
 ('AGUA S GAS P', 5.00, 'UN', '22011000', '0300500', 'Água mineral sem gás pequena'),
 ('AGUA S GAS G', 8.00, 'UN', '22011000', '0300400', 'Água mineral sem gás grande'),
 ('SUCO C AGUA', 12.00, 'CP', '20098990', '', 'Suco natural preparado com água'),
 ('SUCO C LEITE', 12.00, 'CP', '20098990', '', 'Suco natural preparado com leite'),
 ('SUCO JARRA', 24.90, 'UN', '20098990', '', 'Suco natural em jarra'),
 ('SUCO P', 6.00, 'CP', '20098990', '', 'Suco natural copo pequeno'),
 ('SUCO G', 14.90, 'CP', '20098990', '', 'Suco natural copo grande'),
]
ACOMP = 'Acompanha arroz, feijão, farofa e mandioca ou batata.'
G['PORÇÕES COMPLETAS'] = [
 ('CARNE DE SOL COMPLETA', 149.90, 'PO', '02102000', '', 'Carne de sol completa. ' + ACOMP),
 ('PICANHA COMPLETA', 189.90, 'PO', '02013000', '', 'Picanha completa. ' + ACOMP),
 ('TILAPIA EM POSTA COMPLETA', 139.90, 'PO', '03032300', '', 'Tilápia em posta completa. ' + ACOMP),
 ('CONTRA FILE ACEBOLADO COMPLETO', 169.90, 'PO', '02013000', '', 'Contra filé acebolado completo. ' + ACOMP),
 ('BISTECA ACEBOLADA COMPLETA', 129.90, 'PO', '02013000', '', 'Bisteca acebolada completa. ' + ACOMP),
]
G['PETISCOS'] = [
 ('CARNE DE SOL PETISCO', 89.90, 'PO', '02102000', '', 'Carne de sol. Opções de acompanhamento: batata ou mandioca.'),
 ('CONTRA FILE ACEBOLADO PETISCO', 139.90, 'PO', '02013000', '', 'Contra filé acebolado. Acompanha mandioca.'),
 ('FRANGO A PASSARINHO', 53.90, 'PO', '02071400', '', 'Frango a passarinho. Acompanha batata.'),
 ('CALABRESA', 59.90, 'PO', '16010000', '', 'Calabresa. Acompanha batata.'),
 ('COSTELINHA', 69.90, 'PO', '02032900', '', 'Costelinha suína. Acompanha mandioca.'),
 ('BATATA FRITA SIMPLES', 34.90, 'PO', '20041000', '', 'Porção de batata frita simples.'),
 ('BATATA FRITA PREMIUM', 48.90, 'PO', '20041000', '', 'Batata frita premium com queijo e bacon.'),
 ('PASTEL MINI 10 UND', 49.90, 'PO', '19059090', '', 'Pastel mini, 10 unidades. Sabores: carne, queijo e calabresa.'),
 ('QUEIJO COALHO', 23.90, 'PO', '04069010', '', 'Queijo coalho.'),
 ('FRIOS', 49.90, 'PO', '04069090', '', 'Tábua de frios com queijo, salame e azeitona.'),
]
G['PORÇÕES'] = [
 ('ISCA DE PEIXE', 69.90, 'PO', '16041900', '', 'Porção de isca de peixe.'),
 ('KIBE COM QUEIJO', 49.90, 'PO', '16025000', '', 'Porção de kibe recheado com queijo.'),
 ('CAMARAO EMPANADO', 69.90, 'PO', '16052900', '', 'Porção de camarão empanado.'),
 ('BOLINHO DE BACALHAU', 69.90, 'PO', '16042000', '', 'Porção de bolinho de bacalhau.'),
 ('ANEL DE CEBOLA', 30.00, 'PO', '20049000', '', 'Porção de anel de cebola empanado.'),
 ('FILE DE TILAPIA', 89.90, 'PO', '03046100', '', 'Porção de filé de tilápia.'),
 ('TILAPIA EM POSTA', 89.90, 'PO', '03032300', '', 'Porção de tilápia em posta.'),
 ('ALMONDEGA AO MOLHO', 7.00, 'UN', '16025000', '', 'Almôndega ao molho (preço por unidade).'),
 ('LINGUICA APIMENTADA', 12.00, 'UN', '16010000', '', 'Linguiça apimentada (preço por unidade).'),
 ('LINGUICA TOSCANA', 8.00, 'UN', '16010000', '', 'Linguiça toscana (preço por unidade).'),
 ('LINGUICA CASEIRA', 12.00, 'UN', '16010000', '', 'Linguiça caseira (preço por unidade).'),
]

ALC = {'CERVEJAS', 'ICE', 'DRINKS'}
wb = openpyxl.load_workbook(tpl)
ws = wb['importar_produtos']
hdr = [c.value for c in ws[1]]
ws.delete_rows(2, ws.max_row)
n = 0
for grupo, itens in G.items():
    for nome, valor, un, ncm, cest, desc in itens:
        assert len(nome) <= 30, nome
        n += 1
        st = bool(cest)  # item com CEST = substituição tributária
        comida = grupo in ('PORÇÕES COMPLETAS', 'PETISCOS', 'PORÇÕES')
        csosn = 102
        cfop = 5101 if comida else 5102
        pis_cst = 49
        bebida = grupo in ('CERVEJAS', 'ICE', 'DRINKS', 'SEM ÁLCOOL')
        row = {
            'Codigo': 0, 'DescricaoCupom': nome, 'CodGrupo': 0, 'NomeGrupo': grupo,
            'E_Servico': 'False', 'CodigoVenda': n, 'Status': 'True', 'Unidade': un,
            'CodigoFornecedor': 0, 'LocalEstoque': None, 'EstoqueMinimo': 0, 'EstoqueMaximo': 0,
            'CampoFracionado': 'False', 'Origem': 'N', 'CodigoEAN': None, 'ChamaBalanca': 'False',
            'ChamaQuantidade': 'False', 'Favorito': 'False', 'CodigoImpressora': 0,
            'NomeImpressora': 'Caixa', 'PermiteDesconto': 'True', 'IncideAcrescimo': 'True',
            'PedePrecoVenda': 'False', 'BaixaEstoque': 'True' if bebida else 'False',
            'TipoBaixaEstoque': 1 if bebida else 0, 'DescricaoDetalhada': desc,
            'CodigoNCM': ncm, 'CodigoCest': cest or None, 'Valor': valor,
            'CodICMS_ISS': 5, 'CodCFOP': cfop, 'CodCSOSN': csosn, 'CodPisCofins': pis_cst, 'PIS': 0,
            'Cofins': 0, 'Federal_nacional': 0, 'Estadual': 0, 'Federal_importado': 0,
            'CodServico': 0, 'CodCST': 0, 'Pausado': 'False', 'ChamaModificadores': 'False',
            'EdicaoModificadorvenda': 'False',
            'VendaApenasParaMaior': 'True' if grupo in ALC else 'False',
            'AutoAtendimento': 'False', 'ModoPreparo': None, 'PausarEstoqueAbaixoDoMinimo': 'False',
            'Markup': 0, 'ControlaValidade': 'False', 'DiasAlertaValidade': 0,
            'EnabledVendaDelivery': True, 'EnabledVendaBalcao': True, 'EnabledVendaMesa': True,
            'DescricaoTabletQrCodeMesa': desc, 'Classes': grupo.title(),
        }
        ws.append([row[h] for h in hdr])
        r = ws.max_row
        ws.cell(r, hdr.index('CodigoNCM') + 1).number_format = '@'
        ws.cell(r, hdr.index('CodigoCest') + 1).number_format = '@'
wb.save(OUT)

# arquivo só com os 31 itens que falharam antes (os que têm CEST)
wb2 = openpyxl.load_workbook(OUT)
ws2 = wb2['importar_produtos']
cest_i = hdr.index('CodigoCest')
for r in range(ws2.max_row, 1, -1):
    if not ws2.cell(r, cest_i + 1).value:
        ws2.delete_rows(r)
wb2.save(OUT.replace('.xlsx', '_somente_31_pendentes.xlsx'))
print(ws2.max_row - 1, 'pendentes')
print(n, 'produtos')


